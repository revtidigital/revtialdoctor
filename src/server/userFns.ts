import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "./db";
import {
  categorize,
  computeTotal,
  dedupeAttempts,
  type PlayAttempt,
  type UserRecord,
} from "@/lib/storage";
import { checkRateLimit, getClientIp, requireAdminToken } from "./security";

const MAX_GAME_SCORE = 1500;
const MAX_PLAY_ATTEMPTS_STORED = 500;

const gameScoresSchema = z.object({
  reflex: z.number().nullable(),
  memory: z.number().nullable(),
  balance: z.number().nullable(),
});

/** Clamp a client-submitted score to the range the game client can actually produce. */
function clampScores(s: z.infer<typeof gameScoresSchema>): z.infer<typeof gameScoresSchema> {
  const clamp = (v: number | null) =>
    v === null ? null : Math.max(0, Math.min(MAX_GAME_SCORE, Math.round(v)));
  return { reflex: clamp(s.reflex), memory: clamp(s.memory), balance: clamp(s.balance) };
}

const userRecordSchema = z.object({
  userId: z.string(),
  contact: z.string().min(1),
  email: z.string().nullish(),
  name: z.string().nullish(),
  address: z.string().nullish(),
  role: z.enum(["doctor", "pharmacy"]).nullish(),
  scores: gameScoresSchema,
  total: z.number(),
  category: z.string(),
  consent: z.boolean(),
  createdAt: z.string(),
  playDates: z.array(z.string()).optional(),
  playAttempts: z
    .array(
      z.object({
        playedAt: z.string(),
        date: z.string(),
        scores: gameScoresSchema,
        total: z.number(),
        category: z.string(),
      }),
    )
    .optional(),
  referredBy: z.string().nullish(),
  referCount: z.number().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmTerm: z.string().optional(),
  utmContent: z.string().optional(),
  winnerLockDates: z.array(z.string()).optional(),
});

const contactSchema = z.object({ contact: z.string().min(1) });
const userIdSchema = z.object({ userId: z.string().min(1) });

// ── save / upsert ──────────────────────────────────────────────────────────────
// Scores/total are never trusted from the client: every score is clamped to the
// range the game UI can actually produce, and `total` is always recomputed
// server-side from the (clamped) scores. This prevents a scripted call from
// forging a top leaderboard position or triggering the automated winner email.
export const saveUserFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => userRecordSchema.parse(data))
  .handler(async ({ data }) => {
    await checkRateLimit(`save-user:${getClientIp()}`, 60, 60);

    const db = await getDb();
    const clampedScores = clampScores(data.scores);
    const recomputedTotal = computeTotal(clampedScores);
    const normalized = {
      ...data,
      contact: data.contact.toLowerCase(),
      email: data.email ?? undefined,
      name: data.name ?? undefined,
      address: data.address ?? undefined,
      role: data.role ?? undefined,
      referredBy: data.referredBy?.trim().toUpperCase(),
      scores: clampedScores,
      total: recomputedTotal,
      category: categorize(recomputedTotal).label,
      playAttempts: (data.playAttempts ?? []).map((a) => {
        const scores = clampScores(a.scores);
        const total = computeTotal(scores);
        return { ...a, scores, total, category: categorize(total).label };
      }),
    };

    // Check if this is a brand-new referral for this user (to avoid double-counting)
    const existing = await db
      .collection<UserRecord>("users")
      .findOne({ contact: normalized.contact });
    const firstTimeReferral = normalized.referredBy && !existing?.referredBy;

    // Merge playDates / playAttempts deterministically so repeated saves do not duplicate attempts.
    const mergedPlayDates = [
      ...new Set([...(existing?.playDates ?? []), ...(normalized.playDates ?? [])]),
    ];
    const dedupedAttempts = dedupeAttempts([
      ...((existing?.playAttempts ?? []) as PlayAttempt[]),
      ...((normalized.playAttempts ?? []) as PlayAttempt[]),
    ]);
    // Cap stored history so a scripted play-loop can't grow a document without bound.
    const mergedAttempts = dedupedAttempts
      .slice()
      .sort((a, b) => a.playedAt.localeCompare(b.playedAt))
      .slice(-MAX_PLAY_ATTEMPTS_STORED);
    const bestAttempt = mergedAttempts.reduce<PlayAttempt | null>(
      (best, curr) => (!best || curr.total > best.total ? curr : best),
      null,
    );

    await db.collection<UserRecord>("users").updateOne(
      { contact: normalized.contact },
      {
        $set: {
          ...normalized,
          playDates: mergedPlayDates,
          playAttempts: mergedAttempts,
          scores: bestAttempt?.scores ?? normalized.scores,
          total: bestAttempt?.total ?? normalized.total,
          category: bestAttempt?.category ?? normalized.category,
        },
      },
      { upsert: true },
    );

    // Increment referrer's referCount on first referral only
    if (firstTimeReferral) {
      await db
        .collection<UserRecord>("users")
        .updateOne({ userId: normalized.referredBy! }, { $inc: { referCount: 1 } });
    }

    return { ok: true };
  });

// ── get by contact ─────────────────────────────────────────────────────────────
// NOTE: this app's "login" is just a phone number with no OTP/possession check, so
// this lookup is reachable by anyone who can guess a phone number. Rate-limiting
// makes bulk enumeration impractical; it does not make this a real auth boundary.
// Closing that gap fully would require reintroducing phone verification, which is
// a deliberate product decision, not something to change silently here.
export const getUserByContactFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }) => {
    await checkRateLimit(`lookup:${getClientIp()}`, 30, 60);
    const db = await getDb();
    const user = await db
      .collection<UserRecord & { _id: unknown }>("users")
      .findOne({ contact: data.contact.toLowerCase() });
    if (!user) return null;
    const { _id: _unused, ...rest } = user;
    return rest as UserRecord;
  });

// ── get by userId ─────────────────────────────────────────────────────────────
export const getUserByIdFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => userIdSchema.parse(data))
  .handler(async ({ data }) => {
    await checkRateLimit(`lookup:${getClientIp()}`, 30, 60);
    const db = await getDb();
    const user = await db
      .collection<UserRecord & { _id: unknown }>("users")
      .findOne({ userId: data.userId });
    if (!user) return null;
    const { _id: _unused, ...rest } = user;
    return rest as UserRecord;
  });

// ── reCAPTCHA verification ────────────────────────────────────────────────────
export const verifyCaptchaFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const db = await getDb();
    const settings = await db.collection("platform_settings").findOne({ _key: "main" });
    const secret = (settings as Record<string, unknown> | null)?.recaptchaSecret as
      | string
      | undefined;

    // If reCAPTCHA is not configured, pass through.
    if (!secret) return { ok: true, skipped: true };
    // Empty token means the script hasn't loaded yet — pass through rather than block user.
    if (!data.token) return { ok: true, skipped: true };

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: data.token }).toString(),
    });
    const json = (await res.json()) as {
      success: boolean;
      score?: number;
      "error-codes"?: string[];
    };
    // v3: also require a human-like score (≥ 0.5). v2 doesn't include a score.
    const scoreOk = json.score === undefined || json.score >= 0.5;
    return { ok: json.success && scoreOk };
  });

// ── get all (public-safe fields only — used by leaderboard/referrals) ──────────
// Deliberately strips email/address/playAttempts so this public, unauthenticated
// RPC can't be used to scrape PII. Admin screens must use getAllUsersAdminFn instead.
export const getAllUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const docs = await db
    .collection<UserRecord & { _id: unknown }>("users")
    .find({})
    .sort({ total: -1 })
    .limit(5000)
    .toArray();
  return docs.map(
    ({ _id: _unused, email: _email, address: _address, playAttempts: _playAttempts, ...rest }) =>
      rest as UserRecord,
  );
});

// ── get all (admin only, full record incl. email/address/playAttempts) ────────
const adminAuthSchema = z.object({ token: z.string() });
export const getAllUsersAdminFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => adminAuthSchema.parse(data))
  .handler(async ({ data }) => {
    requireAdminToken(data.token);
    const db = await getDb();
    const docs = await db
      .collection<UserRecord & { _id: unknown }>("users")
      .find({})
      .sort({ total: -1 })
      .limit(5000)
      .toArray();
    return docs.map(({ _id: _unused, ...rest }) => rest as UserRecord);
  });

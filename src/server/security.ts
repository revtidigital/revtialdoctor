import { getRequestHeaders } from "@tanstack/start-server-core";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";

export const getClientIp = (): string => {
  const headers = getRequestHeaders();
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("true-client-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-client-ip") ??
    forwardedFor ??
    "unknown"
  );
};

/**
 * Fixed-window rate limiter backed by Mongo so it works across the PM2 cluster's
 * multiple worker processes (an in-memory Map would be per-worker and useless).
 * Throws if the caller has exceeded `max` requests for `key` within `windowSeconds`.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<void> {
  const db = await getDb();
  const coll = db.collection("rate_limits");
  const windowMs = windowSeconds * 1000;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const bucketId = `${key}:${windowStart}`;

  const result = await coll.findOneAndUpdate(
    { bucketId },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs) } },
    { upsert: true, returnDocument: "after" },
  );

  const count = (result as unknown as { count: number } | null)?.count ?? 1;
  if (count > max) {
    throw new Error("Too many requests. Please try again later.");
  }
}

/** Ensures the TTL index exists so rate-limit buckets self-clean. Safe to call repeatedly. */
export async function ensureRateLimitIndex(): Promise<void> {
  const db = await getDb();
  await db
    .collection("rate_limits")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    .catch(() => {});
}

// ── Admin session tokens ─────────────────────────────────────────────────────
// Signed, time-limited tokens issued after a correct admin password check, so the
// client never has to re-send (or persist) the raw admin password after login.
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function getTokenSecret(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("ADMIN_PASSWORD environment variable is not set");
  }
  return secret;
}

export function issueAdminToken(): string {
  const expiresAt = Date.now() + ADMIN_TOKEN_TTL_MS;
  const sig = createHmac("sha256", getTokenSecret()).update(String(expiresAt)).digest("hex");
  return `${expiresAt}.${sig}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expiresAtStr, sig] = token.split(".");
  if (!expiresAtStr || !sig) return false;
  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSig = createHmac("sha256", getTokenSecret()).update(expiresAtStr).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requireAdminToken(token: string | undefined | null): void {
  if (!verifyAdminToken(token)) {
    throw new Error("Unauthorized");
  }
}

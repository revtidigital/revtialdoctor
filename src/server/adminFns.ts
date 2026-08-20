import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/start-server-core";
import { z } from "zod";
import { getDb } from "./db";
import type { UserRecord } from "@/lib/storage";
import tls from "node:tls";
import { createCanvas, loadImage, registerFont } from "canvas";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Admin Auth ─────────────────────────────────────────────────────────────────
/** Verify admin password on the server (compares against ADMIN_PASSWORD env var). */
export const verifyAdminPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ password: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const expected = process.env.ADMIN_PASSWORD ?? "admin123";
    return { ok: data.password === expected };
  });

// ── Admin Log ──────────────────────────────────────────────────────────────────
export interface AdminLog {
  logId: string;
  timestamp: string;
  action: string;
  details: string;
  country?: string;
  countryName?: string;
  ip?: string;
}

const addLogSchema = z.object({
  action: z.string().min(1),
  details: z.string(),
});

const getClientCountry = (): string => {
  const headers = getRequestHeaders();

  return (
    headers.get("cf-ipcountry") ??
    headers.get("x-vercel-ip-country") ??
    headers.get("x-country-code") ??
    "Unknown"
  );
};

const getCountryName = (countryCode: string): string => {
  if (!countryCode || countryCode === "Unknown") return "Unknown";

  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode.toUpperCase()) ?? countryCode
    );
  } catch {
    return countryCode;
  }
};

const getClientIp = (): string => {
  const headers = getRequestHeaders();
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return (
    headers.get("cf-connecting-ip") ??
    headers.get("true-client-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-client-ip") ??
    forwardedFor ??
    "Unknown"
  );
};

/** Append a new admin log entry — logs are never deleted. */
export const addAdminLogFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => addLogSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb();
    const country = getClientCountry();
    const entry: AdminLog = {
      logId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: data.action,
      details: data.details,
      country,
      countryName: getCountryName(country),
      ip: getClientIp(),
    };
    await db.collection("admin_logs").insertOne(entry);
    return { ok: true };
  });

/** Fetch all admin logs, newest first. Logs are read-only — no delete endpoint exists. */
export const getAdminLogsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const docs = await db
    .collection<AdminLog & { _id: unknown }>("admin_logs")
    .find({})
    .sort({ timestamp: -1 })
    .toArray();
  return docs.map(({ _id: _unused, ...rest }) => rest as AdminLog);
});

// ── Platform Settings ──────────────────────────────────────────────────────────
export interface PlatformSettings {
  ga4: string;
  metaPixel: string;
  clarity: string;
  recaptchaSite: string;
  recaptchaSecret: string;
  homeAnnouncementMode: "winner" | "text" | "leaderboard";
  homeAnnouncementTexts: string[];
  leaderboardAdminEmail: string;
  campaignStartDate: string; // YYYY-MM-DD
}

const settingsSchema = z.object({
  ga4: z.string(),
  metaPixel: z.string(),
  clarity: z.string(),
  recaptchaSite: z.string(),
  recaptchaSecret: z.string(),
  homeAnnouncementMode: z.enum(["winner", "text", "leaderboard"]).default("winner"),
  homeAnnouncementTexts: z.array(z.string()).length(5),
  leaderboardAdminEmail: z.string().default(""),
  campaignStartDate: z.string().default(""),
});

export const savePlatformSettingsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb();
    await db
      .collection("platform_settings")
      .updateOne(
        { _key: "main" },
        { $set: { _key: "main", ...data, updatedAt: new Date().toISOString() } },
        { upsert: true },
      );
    return { ok: true };
  });

export const getPlatformSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const doc = await db.collection("platform_settings").findOne({ _key: "main" });
  if (!doc)
    return {
      ga4: "",
      metaPixel: "",
      clarity: "",
      recaptchaSite: "",
      recaptchaSecret: "",
      homeAnnouncementMode: "winner",
      homeAnnouncementTexts: [
        "🔥 Play now and become today's Revital Energy Challenge winner!",
        "",
        "",
        "",
        "",
      ],
      leaderboardAdminEmail: "",
      campaignStartDate: "",
    } as PlatformSettings;
  const { _id: _a, _key: _b, updatedAt: _c, ...rest } = doc as Record<string, unknown>;

  const legacyText =
    typeof rest.homeAnnouncementText === "string"
      ? rest.homeAnnouncementText
      : "🔥 Play now and become today's Revital Energy Challenge winner!";
  const storedTexts = Array.isArray(rest.homeAnnouncementTexts)
    ? rest.homeAnnouncementTexts.filter((v): v is string => typeof v === "string").slice(0, 5)
    : [];
  while (storedTexts.length < 5) storedTexts.push(storedTexts.length === 0 ? legacyText : "");

  return {
    ...(rest as Omit<PlatformSettings, "homeAnnouncementTexts">),
    homeAnnouncementTexts: storedTexts,
    leaderboardAdminEmail:
      typeof rest.leaderboardAdminEmail === "string" ? rest.leaderboardAdminEmail : "",
    campaignStartDate: typeof rest.campaignStartDate === "string" ? rest.campaignStartDate : "",
  } as PlatformSettings;
});

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;
const GMAIL_FROM_EMAIL = process.env.GMAIL_FROM_EMAIL || "revitalenergyuae@gmail.com";
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

const NAME_SLOTS = [{ x: 537.5, y: 1128.5 }];

const TEMPLATE_WIDTH = 1080;
const TEMPLATE_HEIGHT = 1920;

async function getTemplatePath(): Promise<string> {
  const __dir = dirname(fileURLToPath(import.meta.url));
  // dist/server/assets/adminFns-*.js → ../../public
  const candidate = join(__dir, "../../public/winner-template.png");
  try {
    await readFile(candidate);
    return candidate;
  } catch {
    return join(process.cwd(), "public/winner-template.png");
  }
}

async function generateWinnersPng(
  winners: Array<{ name: string; score: number; contact?: string }>,
): Promise<Buffer> {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const fontCandidate = join(__dir, "../../public/fonts/Duplet-Semibold-BF642a34066f658.otf");
  const fontPath = await readFile(fontCandidate)
    .then(() => fontCandidate)
    .catch(() => join(process.cwd(), "public/fonts/Duplet-Semibold-BF642a34066f658.otf"));
  registerFont(fontPath, { family: "Duplet", weight: "600" });

  const templatePath = await getTemplatePath();
  const templateData = await readFile(templatePath);
  const img = await loadImage(templateData);

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const scaleX = img.width / TEMPLATE_WIDTH;
  const scaleY = img.height / TEMPLATE_HEIGHT;

  winners.slice(0, 1).forEach((winner, index) => {
    const slot = NAME_SLOTS[index];
    if (!slot) return;

    const displayName = winner.name?.trim() || winner.contact || "";
    const maxTextWidth = 660 * scaleX;
    const nameX = slot.x * scaleX;
    const nameY = slot.y * scaleY;
    const fontSize = Math.round(96.03 * Math.min(scaleX, scaleY));
    const ellipsis = "...";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#371812";
    ctx.font = `600 ${fontSize}px Duplet, sans-serif`;

    let textToDraw = displayName;
    if (ctx.measureText(textToDraw).width > maxTextWidth) {
      while (
        textToDraw.length > 0 &&
        ctx.measureText(`${textToDraw}${ellipsis}`).width > maxTextWidth
      ) {
        textToDraw = textToDraw.slice(0, -1);
      }
      textToDraw = textToDraw ? `${textToDraw}${ellipsis}` : ellipsis;
    }

    ctx.fillText(textToDraw, nameX, nameY);
  });

  return canvas.toBuffer("image/png");
}

type SmtpResponse = {
  code: number;
  text: string;
};

const SMTP_TIMEOUT_MS = 20_000;

function readSmtpResponse(socket: tls.TLSSocket): Promise<SmtpResponse> {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onTimeout = () => {
      cleanup();
      reject(new Error("Timed out waiting for SMTP response."));
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const finalLine = [...lines].reverse().find((line) => /^\d{3}\s/.test(line));
      if (!finalLine) return;

      cleanup();
      resolve({ code: Number(finalLine.slice(0, 3)), text: buffer });
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

async function expectSmtp(
  socket: tls.TLSSocket,
  expectedCodes: number[],
  command?: string,
): Promise<SmtpResponse> {
  if (command) socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed (${response.code}): ${response.text.trim()}`);
  }
  return response;
}

const sanitizeMailHeader = (value: string): string => value.replace(/[\r\n]+/g, " ").trim();
const dotStuff = (value: string): string => value.replace(/^\./gm, "..");
const chunkBase64 = (value: string): string => value.match(/.{1,76}/g)?.join("\r\n") ?? "";

async function sendViaGmailSmtp(
  to: string,
  subject: string,
  body: string,
  attachment?: { filename: string; contentType: string; content: string | Buffer },
): Promise<void> {
  if (!GMAIL_FROM_EMAIL || !GMAIL_APP_PASSWORD) {
    throw new Error("Missing Gmail SMTP credentials. Set GMAIL_FROM_EMAIL and GMAIL_APP_PASSWORD.");
  }

  const socket = tls.connect({
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    servername: GMAIL_SMTP_HOST,
  });
  socket.setTimeout(SMTP_TIMEOUT_MS);

  try {
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", resolve);
      socket.once("error", reject);
    });

    await expectSmtp(socket, [220]);
    await expectSmtp(socket, [250], "EHLO revital.local");
    await expectSmtp(socket, [334], "AUTH LOGIN");
    await expectSmtp(socket, [334], Buffer.from(GMAIL_FROM_EMAIL).toString("base64"));
    await expectSmtp(socket, [235], Buffer.from(GMAIL_APP_PASSWORD).toString("base64"));
    await expectSmtp(socket, [250], `MAIL FROM:<${GMAIL_FROM_EMAIL}>`);
    await expectSmtp(socket, [250, 251], `RCPT TO:<${to}>`);
    await expectSmtp(socket, [354], "DATA");

    const safeSubject = sanitizeMailHeader(subject);
    const safeFrom = sanitizeMailHeader(GMAIL_FROM_EMAIL);
    const safeTo = sanitizeMailHeader(to);
    const safeBody = dotStuff(body);

    if (!attachment) {
      socket.write(
        `Subject: ${safeSubject}\r\nFrom: ${safeFrom}\r\nTo: ${safeTo}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${safeBody}\r\n.\r\n`,
      );
    } else {
      const boundary = `revital_${Date.now()}`;
      const rawContent = attachment.content;
      const encoded = chunkBase64(
        (Buffer.isBuffer(rawContent) ? rawContent : Buffer.from(rawContent, "utf8")).toString(
          "base64",
        ),
      );
      socket.write(
        `Subject: ${safeSubject}\r\nFrom: ${safeFrom}\r\nTo: ${safeTo}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${safeBody}\r\n\r\n--${boundary}\r\nContent-Type: ${attachment.contentType}; name="${sanitizeMailHeader(attachment.filename)}"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename="${sanitizeMailHeader(attachment.filename)}"\r\n\r\n${encoded}\r\n--${boundary}--\r\n.\r\n`,
      );
    }

    await expectSmtp(socket, [250]);
    await expectSmtp(socket, [221], "QUIT");
  } finally {
    socket.end();
  }
}

const parseAdminEmails = (input: string): string[] =>
  input
    .split(/[;,\n]/)
    .map((email) => email.trim())
    .filter(Boolean);

const formatUaeDate = (d: Date): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);

export const lockDailyTopTenAndNotifyFn = createServerFn({ method: "POST" }).handler(async () => {
  const db = await getDb();
  const settingsDoc = await db.collection("platform_settings").findOne({ _key: "main" });
  const settings = (settingsDoc ?? {}) as Partial<PlatformSettings>;
  const lockDate = formatUaeDate(new Date());

  const users = await db.collection<UserRecord>("users").find({}).toArray();
  const ranked = users
    // A user can only win once ever — exclude anyone who already has a prior
    // winnerLockDates entry (matches the admin dashboard's Date-wise preview,
    // which already excludes past winners from the live/unlocked leaderboard).
    .filter((u) => !(u.winnerLockDates && u.winnerLockDates.length > 0))
    .map((u) => {
      const todayAttempts = (u.playAttempts ?? []).filter((a) => a.date === lockDate);
      const best = todayAttempts.reduce<number>((m, a) => Math.max(m, a.total), -1);
      // Earliest attempt that achieved the best score (tiebreaker)
      const firstBestAt = todayAttempts
        .filter((a) => a.total === best)
        .reduce<string>((min, a) => (!min || a.playedAt < min ? a.playedAt : min), "");
      return { userId: u.userId, name: u.name || u.contact, score: best, firstBestAt };
    })
    .filter((u) => u.score >= 0)
    .sort((a, b) => b.score - a.score || a.firstBestAt.localeCompare(b.firstBestAt))
    .slice(0, 1);

  if (!ranked.length) return { ok: true, lockDate, winners: 0, mailed: false };

  await Promise.all(
    ranked.map((winner) =>
      db
        .collection<UserRecord>("users")
        .updateOne({ userId: winner.userId }, { $addToSet: { winnerLockDates: lockDate } }),
    ),
  );

  const adminEmails = parseAdminEmails(settings.leaderboardAdminEmail || "");
  if (!adminEmails.length) {
    return { ok: true, lockDate, winners: ranked.length, mailed: false };
  }
  const dayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    weekday: "long",
  }).format(new Date(`${lockDate}T12:00:00+04:00`));
  const enrichedSubject = `Winner Locked: ${lockDate} (${dayName}) UAE`;
  const winner = ranked[0];
  const text = `Daily Winner\n\n${winner.name} — Score: ${winner.score}`;
  const winnersPng = await generateWinnersPng(ranked);
  await Promise.all(
    adminEmails.map((email) =>
      sendViaGmailSmtp(email, enrichedSubject, text, {
        filename: `revital-winner-${lockDate}.png`,
        contentType: "image/png",
        content: winnersPng,
      }),
    ),
  );
  return { ok: true, lockDate, winners: ranked.length, mailed: true, adminEmails };
});

export const getGlobalLeaderboardFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const [users, settingsDoc] = await Promise.all([
    db.collection<UserRecord>("users").find({}).toArray(),
    db.collection("platform_settings").findOne({ _key: "main" }),
  ]);
  const settings = (settingsDoc ?? {}) as Partial<PlatformSettings>;

  // Total campaign days — from configured start date or earliest user createdAt
  const today = formatUaeDate(new Date());
  const todayMs = new Date(today + "T00:00:00+04:00").getTime();
  let campaignStartMs: number;
  if (settings.campaignStartDate) {
    campaignStartMs = new Date(settings.campaignStartDate + "T00:00:00+04:00").getTime();
  } else {
    const earliest = users.reduce<string | null>((min, u) => {
      if (!u.createdAt) return min;
      return !min || u.createdAt < min ? u.createdAt : min;
    }, null);
    campaignStartMs = earliest ? new Date(earliest).getTime() : todayMs;
  }
  const totalCampaignDays = Math.max(1, Math.round((todayMs - campaignStartMs) / 86_400_000) + 1);

  const mask = (c: string) => {
    if (c.includes("@")) {
      const [a, b] = c.split("@");
      return a.slice(0, 2) + "•••@" + b;
    }
    if (c.length > 4) return c.slice(0, 3) + "•••" + c.slice(-2);
    return c;
  };

  const scored = users
    .map((u) => {
      const attempts = u.playAttempts ?? [];
      const uniqueDates = [...new Set(attempts.map((a) => a.date))];
      const activeDays = uniqueDates.length;
      if (activeDays === 0) return null;

      // Best attempt per day — use sum of 3 game scores (max 4500/day per spec)
      const dailyBests = uniqueDates.map((date) =>
        attempts
          .filter((a) => a.date === date)
          .reduce((best, cur) => {
            const curSum =
              (cur.scores.reflex ?? 0) + (cur.scores.memory ?? 0) + (cur.scores.balance ?? 0);
            const bestSum =
              (best.scores.reflex ?? 0) + (best.scores.memory ?? 0) + (best.scores.balance ?? 0);
            return curSum > bestSum ? cur : best;
          }),
      );

      const sumDailyBest = dailyBests.reduce(
        (s, a) => s + (a.scores.reflex ?? 0) + (a.scores.memory ?? 0) + (a.scores.balance ?? 0),
        0,
      );
      const performanceScore = sumDailyBest / activeDays;
      const consistencyMultiplier = 1 + (activeDays / totalCampaignDays) * 0.2;
      const adjustedPerformance = performanceScore * consistencyMultiplier;

      const validReferrals = Math.min(u.referCount ?? 0, 20);
      const referralScore = validReferrals * 50;

      const finalScore = adjustedPerformance * 0.8 + referralScore * 0.2;

      // Tiebreaker data
      const avgReflex = dailyBests.reduce((s, a) => s + (a.scores.reflex ?? 0), 0) / activeDays;
      const avgMemory = dailyBests.reduce((s, a) => s + (a.scores.memory ?? 0), 0) / activeDays;
      const avgBalance = dailyBests.reduce((s, a) => s + (a.scores.balance ?? 0), 0) / activeDays;
      const earliestPlayedAt = attempts.reduce(
        (min, a) => (a.playedAt < min ? a.playedAt : min),
        attempts[0]?.playedAt ?? "",
      );

      return {
        name: u.name || "Player",
        contact: mask(u.contact),
        total: Math.round(finalScore),
        category: u.category,
        when: "All-time",
        _activeDays: activeDays,
        _avgReflex: avgReflex,
        _avgMemory: avgMemory,
        _avgBalance: avgBalance,
        _referCount: u.referCount ?? 0,
        _earliestPlayedAt: earliestPlayedAt,
      };
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  scored.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b._activeDays !== a._activeDays) return b._activeDays - a._activeDays;
    if (b._avgReflex !== a._avgReflex) return b._avgReflex - a._avgReflex;
    if (b._avgMemory !== a._avgMemory) return b._avgMemory - a._avgMemory;
    if (b._avgBalance !== a._avgBalance) return b._avgBalance - a._avgBalance;
    if (b._referCount !== a._referCount) return b._referCount - a._referCount;
    return a._earliestPlayedAt.localeCompare(b._earliestPlayedAt);
  });

  return scored
    .slice(0, 10)
    .map(
      ({
        _activeDays: _,
        _avgReflex: _r,
        _avgMemory: _m,
        _avgBalance: _b,
        _referCount: _rc,
        _earliestPlayedAt: _e,
        ...entry
      }) => entry,
    );
});

export const getPreviousDayWinnersFn = createServerFn({ method: "GET" }).handler(async () => {
  const db = await getDb();
  const yesterday = formatUaeDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const users = await db
    .collection<UserRecord>("users")
    .find({ winnerLockDates: yesterday })
    .toArray();

  const ranked = users
    .map((u) => {
      const best = (u.playAttempts ?? [])
        .filter((a) => a.date === yesterday)
        .reduce<number>((m, a) => Math.max(m, a.total), 0);
      return { name: u.name || u.contact || "Player", score: best };
    })
    .sort((a, b) => b.score - a.score);

  return { date: yesterday, winners: ranked };
});

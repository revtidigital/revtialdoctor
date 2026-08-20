#!/usr/bin/env node
// Standalone cron script — locks the daily top-10 winners and emails admins.
// Mirrors the logic in src/server/adminFns.ts:lockDailyTopTenAndNotifyFn.
import { MongoClient } from "mongodb";
import tls from "node:tls";
import { createCanvas, loadImage, registerFont } from "canvas";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ───────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://mongo:27017/rev-challenge-hub";
const GMAIL_FROM_EMAIL = process.env.GMAIL_FROM_EMAIL || "revitalenergyuae@gmail.com";
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || "zkve peto wnre mhmx").replace(
  /\s+/g,
  "",
);
const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 465;
const SMTP_TIMEOUT_MS = 20_000;

// ── Date helpers ─────────────────────────────────────────────────────────────
const formatUaeDate = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);

// ── Email helpers ─────────────────────────────────────────────────────────────
const sanitizeMailHeader = (v) => v.replace(/[\r\n]+/g, " ").trim();
const dotStuff = (v) => v.replace(/^\./gm, "..");
const chunkBase64 = (v) => v.match(/.{1,76}/g)?.join("\r\n") ?? "";
const parseAdminEmails = (input) =>
  input
    .split(/[;,\n]/)
    .map((e) => e.trim())
    .filter(Boolean);

// ── SMTP ──────────────────────────────────────────────────────────────────────
function readSmtpResponse(socket) {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error("Timed out waiting for SMTP response."));
    };
    const onData = (chunk) => {
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

async function expectSmtp(socket, expectedCodes, command) {
  if (command) socket.write(`${command}\r\n`);
  const response = await readSmtpResponse(socket);
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP command failed (${response.code}): ${response.text.trim()}`);
  }
  return response;
}

async function sendViaGmailSmtp(to, subject, body, attachment) {
  const socket = tls.connect({
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    servername: GMAIL_SMTP_HOST,
  });
  socket.setTimeout(SMTP_TIMEOUT_MS);

  try {
    await new Promise((resolve, reject) => {
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

// ── PNG generation ────────────────────────────────────────────────────────────
const NAME_SLOTS = [
  { x: 321.5, y: 735.5 },
  { x: 779.5, y: 735.5 },
  { x: 321.5, y: 842.5 },
  { x: 779.5, y: 842.5 },
  { x: 321.5, y: 949.5 },
  { x: 779.5, y: 949.5 },
  { x: 321.5, y: 1056.5 },
  { x: 779.5, y: 1056.5 },
  { x: 321.5, y: 1163.5 },
  { x: 779.5, y: 1163.5 },
];
const TEMPLATE_WIDTH = 1080;
const TEMPLATE_HEIGHT = 1920;

async function generateWinnersPng(winners) {
  const fontPath = join(__dirname, "../public/fonts/Duplet-Semibold-BF642a34066f658.otf");
  registerFont(fontPath, { family: "Duplet", weight: "600" });

  const templatePath = join(__dirname, "../public/winners-template.png");
  const templateData = await readFile(templatePath);
  const img = await loadImage(templateData);

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const scaleX = img.width / TEMPLATE_WIDTH;
  const scaleY = img.height / TEMPLATE_HEIGHT;

  winners.slice(0, 10).forEach((winner, index) => {
    const slot = NAME_SLOTS[index];
    if (!slot) return;

    const displayName = winner.name?.trim() || winner.contact || "";
    const maxTextWidth = 280 * scaleX;
    const nameX = slot.x * scaleX - maxTextWidth / 2;
    const nameY = slot.y * scaleY;
    const fontSize = Math.round(35 * Math.min(scaleX, scaleY));
    const ellipsis = "...";

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#461901";
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const client = new MongoClient(MONGODB_URI, {
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    await client.connect();
    const db = client.db("revital");

    const settingsDoc = await db.collection("platform_settings").findOne({ _key: "main" });
    const settings = settingsDoc ?? {};
    const lockDate = formatUaeDate(new Date());

    console.log(`[lock-winners] Date: ${lockDate}`);

    const users = await db.collection("users").find({}).toArray();
    const ranked = users
      .filter((u) => !u.winnerLockDates || u.winnerLockDates.length === 0) // never re-select a past winner
      .map((u) => {
        const best = (u.playAttempts ?? [])
          .filter((a) => a.date === lockDate)
          .reduce((m, a) => Math.max(m, a.total), -1);
        return { userId: u.userId, name: u.name || u.contact, score: best };
      })
      .filter((u) => u.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (!ranked.length) {
      console.log(`[lock-winners] No players found for ${lockDate} — nothing to lock.`);
      return;
    }

    console.log(`[lock-winners] Locking ${ranked.length} winner(s).`);
    await Promise.all(
      ranked.map((winner) =>
        db
          .collection("users")
          .updateOne({ userId: winner.userId }, { $addToSet: { winnerLockDates: lockDate } }),
      ),
    );

    const adminEmails = parseAdminEmails(settings.leaderboardAdminEmail || "");
    if (!adminEmails.length) {
      console.log(`[lock-winners] Winners locked. No admin email configured — skipping email.`);
      return;
    }

    const dayName = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dubai",
      weekday: "long",
    }).format(new Date(`${lockDate}T12:00:00+04:00`));

    const subject = `Winners Locked: ${lockDate} (${dayName}) UAE`;
    const text = ranked.map((w, i) => `#${i + 1} ${w.name} — ${w.score}`).join("\n");
    const winnersPng = await generateWinnersPng(ranked);

    await Promise.all(
      adminEmails.map((email) =>
        sendViaGmailSmtp(email, subject, text, {
          filename: `revital-winners-${lockDate}.png`,
          contentType: "image/png",
          content: winnersPng,
        }),
      ),
    );

    console.log(`[lock-winners] Email sent to: ${adminEmails.join(", ")}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("[lock-winners] Fatal error:", err);
  process.exit(1);
});

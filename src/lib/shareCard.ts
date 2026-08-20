// Generates a branded share card PNG (1080x1350 — Instagram portrait) with logo, score, category and tag.
import logoUrl from "@/assets/revital-logo.png";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export interface ShareCardData {
  name?: string;
  total: number;
  category: string;
  tier: string;
}

export async function buildShareCard(data: ShareCardData): Promise<Blob> {
  const W = 1080,
    H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background gradient (dark warm)
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1a0f08");
  bg.addColorStop(0.5, "#2a160a");
  bg.addColorStop(1, "#0d0604");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Glow blob
  const glow = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
  glow.addColorStop(0, "rgba(255,140,40,0.35)");
  glow.addColorStop(1, "rgba(255,140,40,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Logo
  try {
    const logo = await loadImage(logoUrl);
    const lw = 360;
    const lh = (logo.height / logo.width) * lw;
    ctx.drawImage(logo, (W - lw) / 2, 90, lw, lh);
  } catch {
    // logo is optional decoration — card still renders without it
  }

  // Header text
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,220,170,0.8)";
  ctx.font = "600 32px system-ui, -apple-system, sans-serif";
  ctx.fillText("ENERGY CHALLENGE", W / 2, 320);

  if (data.name) {
    ctx.fillStyle = "#fff";
    ctx.font = "700 44px system-ui, -apple-system, sans-serif";
    ctx.fillText(data.name, W / 2, 380);
  }

  // Score circle
  const cx = W / 2,
    cy = 720,
    r = 230;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fill();
  ctx.lineWidth = 18;
  const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, "#ffd84a");
  grad.addColorStop(0.5, "#ff8a2a");
  grad.addColorStop(1, "#e8421f");
  ctx.strokeStyle = grad;
  const pct = Math.max(0, Math.min(1, data.total / 1500));
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
  ctx.stroke();

  // Percentage number
  const percentage = Math.max(0, Math.min(100, (data.total / 1500) * 100));
  ctx.fillStyle = "#fff";
  ctx.font = "900 132px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${percentage.toFixed(2)}%`, cx, cy + 35);

  // Category pill
  ctx.font = "800 48px system-ui, -apple-system, sans-serif";
  const label = `★ ${data.category}  ·  Tier ${data.tier}`;
  const metrics = ctx.measureText(label);
  const pillW = metrics.width + 80;
  const pillH = 90;
  const pillX = (W - pillW) / 2;
  const pillY = 1030;
  const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
  pillGrad.addColorStop(0, "#ffd84a");
  pillGrad.addColorStop(1, "#e8421f");
  ctx.fillStyle = pillGrad;
  roundRect(ctx, pillX, pillY, pillW, pillH, 45);
  ctx.fill();
  ctx.fillStyle = "#1a0f08";
  ctx.fillText(label, W / 2, pillY + 60);

  // Footer
  ctx.fillStyle = "#6b1f12";
  ctx.font = "600 36px system-ui, -apple-system, sans-serif";
  ctx.fillText("Tag @revital.uae to win 🏆", W / 2, 1200);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("Take the challenge at revital.com", W / 2, 1260);

  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png", 0.95));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Generates a share card by stamping score, name, tier, and category onto the user template PNG.
export async function buildShareCardFromTemplate(data: ShareCardData): Promise<Blob> {
  // Load Duplit font into the browser font registry before drawing
  const duplitFont = new FontFace("Duplit", "url(/fonts/Duplet-Semibold-BF642a34066f658.otf)", {
    weight: "600",
    style: "normal",
  });
  await duplitFont.load();
  document.fonts.add(duplitFont);

  const template = await loadImage("/user-share-template.png");

  const canvas = document.createElement("canvas");
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(template, 0, 0);

  // Scale factors in case template isn't exactly 1080×1920
  const W = 1080,
    H = 1920;
  const sx = canvas.width / W;
  const sy = canvas.height / H;
  const scale = Math.min(sx, sy);

  const percentage = Math.max(0, Math.min(100, (data.total / 1500) * 100));

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Score — 203px, Duplit, #4D1002
  ctx.fillStyle = "#4D1002";
  ctx.font = `600 ${Math.round(203 * scale)}px Duplit, sans-serif`;
  ctx.fillText(`${percentage.toFixed(2)}%`, 539 * sx, 745.5 * sy, 700 * sx);

  // Name — Duplit Semibold Italic, 45px, #FFF2B0
  if (data.name) {
    ctx.fillStyle = "#FFF2B0";
    ctx.font = `italic 600 ${Math.round(45 * scale)}px Duplit, sans-serif`;
    ctx.fillText(truncateText(ctx, data.name, 200 * sx), 548.5 * sx, 906.5 * sy);
  }

  // Category (left) and Tier (right) — swapped, Duplit Semibold Italic, 58px, #A02509
  ctx.fillStyle = "#A02509";
  ctx.font = `italic 600 ${Math.round(58 * scale)}px Duplit, sans-serif`;

  // Center category within the left box
  ctx.textAlign = "center";
  ctx.fillText(truncateText(ctx, data.category, 420 * sx), 429.5 * sx, 1034.5 * sy);

  // Tier stays center-aligned in its right box
  ctx.textAlign = "center";
  ctx.fillText(truncateText(ctx, `Tier ${data.tier}`, 220 * sx), 767.5 * sx, 1034.5 * sy);

  return new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png", 0.95));
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t ? t + "…" : "…";
}

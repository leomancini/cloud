/**
 * Generates cloud app icons at 192x192 and 512x512 using the Canvas API via
 * the `canvas` npm package. Run with: node scripts/generate-icons.mjs
 *
 * Install dep once:  npm install canvas
 */

import { createCanvas } from "canvas";
import fs from "fs";
import path from "path";

const sizes = [192, 512];
const outDir = path.resolve("public/icons");
fs.mkdirSync(outDir, { recursive: true });

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const s = size / 192; // scale factor relative to 192 base

  // ── Background: soft sky-blue rounded square ──────────────────────────────
  const r = size * 0.22; // corner radius
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.arcTo(size, 0, size, r, r);
  ctx.lineTo(size, size - r);
  ctx.arcTo(size, size, size - r, size, r);
  ctx.lineTo(r, size);
  ctx.arcTo(0, size, 0, size - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, "#4FC3F7");
  bg.addColorStop(1, "#0288D1");
  ctx.fillStyle = bg;
  ctx.fill();

  // ── Cloud shape (white) ───────────────────────────────────────────────────
  const cx = size / 2;
  const cy = size / 2 + 4 * s;

  // Three overlapping circles + a wide base ellipse
  ctx.fillStyle = "rgba(255,255,255,0.95)";

  // Base rectangle-ish body
  const bx = cx - 52 * s;
  const by = cy - 10 * s;
  const bw = 104 * s;
  const bh = 42 * s;
  const br = 21 * s;

  ctx.beginPath();
  ctx.moveTo(bx + br, by);
  ctx.lineTo(bx + bw - br, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + br, br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.arcTo(bx + bw, by + bh, bx + bw - br, by + bh, br);
  ctx.lineTo(bx + br, by + bh);
  ctx.arcTo(bx, by + bh, bx, by + bh - br, br);
  ctx.lineTo(bx, by + br);
  ctx.arcTo(bx, by, bx + br, by, br);
  ctx.closePath();
  ctx.fill();

  // Left bump
  ctx.beginPath();
  ctx.arc(cx - 28 * s, cy - 12 * s, 26 * s, 0, Math.PI * 2);
  ctx.fill();

  // Centre bump (tallest)
  ctx.beginPath();
  ctx.arc(cx + 2 * s, cy - 26 * s, 32 * s, 0, Math.PI * 2);
  ctx.fill();

  // Right bump
  ctx.beginPath();
  ctx.arc(cx + 32 * s, cy - 14 * s, 24 * s, 0, Math.PI * 2);
  ctx.fill();

  // ── Subtle inner shadow at bottom of cloud ────────────────────────────────
  const shadowGrad = ctx.createLinearGradient(0, cy + 20 * s, 0, cy + 32 * s);
  shadowGrad.addColorStop(0, "rgba(0,80,160,0.08)");
  shadowGrad.addColorStop(1, "rgba(0,80,160,0)");
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.moveTo(bx + br, by + bh - 8 * s);
  ctx.lineTo(bx + bw - br, by + bh - 8 * s);
  ctx.arcTo(bx + bw, by + bh - 8 * s, bx + bw, by + bh - 8 * s + br, br);
  ctx.lineTo(bx + bw, by + bh - br);
  ctx.arcTo(bx + bw, by + bh, bx + bw - br, by + bh, br);
  ctx.lineTo(bx + br, by + bh);
  ctx.arcTo(bx, by + bh, bx, by + bh - br, br);
  ctx.lineTo(bx, by + bh - 8 * s + br);
  ctx.arcTo(bx, by + bh - 8 * s, bx + br, by + bh - 8 * s, br);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

for (const size of sizes) {
  const canvas = drawIcon(size);
  const buf = canvas.toBuffer("image/png");
  const outPath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`✓ Written ${outPath} (${buf.length} bytes)`);
}

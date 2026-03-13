import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });
mkdirSync("public/splash", { recursive: true });

function renderEmoji(size, emojiSize) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.font = `${emojiSize}px "Apple Color Emoji"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☁️", size / 2, size * 0.62);
  return canvas.toBuffer("image/png");
}

function renderSplash(w, h, emojiSize) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${emojiSize}px "Apple Color Emoji"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☁️", w / 2, h * 0.48);
  return canvas.toBuffer("image/png");
}

// Generate favicon (transparent background)
{
  const size = 128;
  const emojiSize = Math.round(size * 0.85);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.font = `${emojiSize}px "Apple Color Emoji"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☁️", size / 2, size * 0.55);
  writeFileSync("public/favicon.png", canvas.toBuffer("image/png"));
  console.log("Generated favicon.png");
}

// Generate app icons
const iconSizes = [180, 192, 512];
for (const size of iconSizes) {
  const emojiSize = Math.round(size * 0.7);
  const buf = renderEmoji(size, emojiSize);
  writeFileSync(`public/icons/icon-${size}.png`, buf);
  console.log(`Generated icon-${size}.png`);
}

// iOS splash screen sizes: [width, height]
const splashSpecs = [
  [640, 1136],
  [750, 1334],
  [828, 1792],
  [1125, 2436],
  [1170, 2532],
  [1179, 2556],
  [1206, 2622],
  [1242, 2208],
  [1242, 2688],
  [1284, 2778],
  [1290, 2796],
  [1320, 2868],
];

for (const [w, h] of splashSpecs) {
  const emojiSize = Math.round(Math.min(w, h) * 0.32);
  const buf = renderSplash(w, h, emojiSize);
  writeFileSync(`public/splash/splash-${w}x${h}.png`, buf);
  console.log(`Generated splash-${w}x${h}.png`);
}

console.log("Done!");

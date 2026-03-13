import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });
mkdirSync("public/splash", { recursive: true });

// Apple Color Emoji renders crisp bitmaps at ~160px.
// Strategy: render emoji at 160px on a proportionally-sized canvas,
// then resize the whole image to the target size with sharp's lanczos3.

async function renderIcon(targetSize) {
  const emojiSize = 160;
  // At 160px emoji, we want it to fill ~70% of the icon
  const canvasSize = Math.round(emojiSize / 0.7);
  const canvas = createCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  ctx.font = `${emojiSize}px "Apple Color Emoji"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☁️", canvasSize / 2, canvasSize * 0.62);
  return sharp(canvas.toBuffer("image/png"))
    .resize(targetSize, targetSize, { kernel: "lanczos3" })
    .png()
    .toBuffer();
}

async function renderSplash(w, h) {
  const emojiSize = 160;
  // Render at a smaller canvas then upscale, or render at full size
  // For splash, we want emoji at ~32% of width. At 160px emoji, canvas width = 160/0.32 = 500
  const scale = w / (emojiSize / 0.32);
  const cw = Math.round(w / scale);
  const ch = Math.round(h / scale);
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.font = `${emojiSize}px "Apple Color Emoji"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☁️", cw / 2, ch * 0.48);
  return sharp(canvas.toBuffer("image/png"))
    .resize(w, h, { kernel: "lanczos3" })
    .png()
    .toBuffer();
}

// Generate favicon (transparent background)
{
  const emojiSize = 160;
  const canvasSize = Math.round(emojiSize / 0.85);
  const canvas = createCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext("2d");
  ctx.font = `${emojiSize}px "Apple Color Emoji"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☁️", canvasSize / 2, canvasSize * 0.55);
  const buf = await sharp(canvas.toBuffer("image/png"))
    .resize(128, 128, { kernel: "lanczos3" })
    .png()
    .toBuffer();
  writeFileSync("public/favicon.png", buf);
  console.log("Generated favicon.png");
}

// Generate app icons
for (const size of [180, 192, 512]) {
  const buf = await renderIcon(size);
  writeFileSync(`public/icons/icon-${size}.png`, buf);
  console.log(`Generated icon-${size}.png`);
}

// iOS splash screens
const splashSpecs = [
  [640, 1136], [750, 1334], [828, 1792], [1125, 2436],
  [1170, 2532], [1179, 2556], [1206, 2622], [1242, 2208],
  [1242, 2688], [1284, 2778], [1290, 2796], [1320, 2868],
];

for (const [w, h] of splashSpecs) {
  const buf = await renderSplash(w, h);
  writeFileSync(`public/splash/splash-${w}x${h}.png`, buf);
  console.log(`Generated splash-${w}x${h}.png`);
}

console.log("Done!");

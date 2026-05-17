import { join } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { __dirname } from "./config.js";

const picturesDir = join(__dirname, "pictures");
if (!existsSync(picturesDir)) mkdirSync(picturesDir);

async function cachePicture(userId, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(picturesDir, `${userId}.jpg`), buffer);
  } catch {}
}

export { picturesDir, cachePicture };

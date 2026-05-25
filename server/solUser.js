import { join } from "path";
import { writeFileSync } from "fs";
import sharp from "sharp";
import db from "./db.js";
import { picturesDir } from "./pictures.js";

// Ensure Sol AI user exists with avatar
const existingClaude = db.prepare("SELECT id FROM users WHERE google_id = 'claude-ai'").get();
const existingSol = db.prepare("SELECT id FROM users WHERE google_id = 'sol-ai'").get();
if (existingClaude && existingSol) {
  db.prepare("UPDATE comments SET user_id = ? WHERE user_id = ?").run(existingSol.id, existingClaude.id);
  db.prepare("DELETE FROM users WHERE google_id = 'claude-ai'").run();
} else if (existingClaude) {
  db.prepare("UPDATE users SET name = 'Sol', google_id = 'sol-ai', email = 'sol@leo.gd' WHERE google_id = 'claude-ai'").run();
} else if (!existingSol) {
  db.prepare("INSERT INTO users (google_id, email, name) VALUES ('sol-ai', 'sol@leo.gd', 'Sol')").run();
}

const solSvg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="200" height="200" fill="#DBEAFE"/>
  <circle cx="100" cy="100" r="25" fill="#F59E0B"/>
  <g stroke="#F59E0B" stroke-width="5" stroke-linecap="round">
    <line x1="100" y1="55" x2="100" y2="65"/>
    <line x1="100" y1="135" x2="100" y2="145"/>
    <line x1="55" y1="100" x2="65" y2="100"/>
    <line x1="135" y1="100" x2="145" y2="100"/>
    <line x1="68" y1="68" x2="75" y2="75"/>
    <line x1="125" y1="125" x2="132" y2="132"/>
    <line x1="132" y1="68" x2="125" y2="75"/>
    <line x1="75" y1="125" x2="68" y2="132"/>
  </g>
</svg>`;

const solUser = db.prepare("SELECT id FROM users WHERE google_id = 'sol-ai'").get();
const SOL_USER_ID = solUser.id;

const solAvatarBuf = await sharp(Buffer.from(solSvg)).jpeg({ quality: 90 }).toBuffer();
writeFileSync(join(picturesDir, "sol.jpg"), solAvatarBuf);
writeFileSync(join(picturesDir, `${SOL_USER_ID}.jpg`), solAvatarBuf);

export { SOL_USER_ID };

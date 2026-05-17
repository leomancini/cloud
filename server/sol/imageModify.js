import { join } from "path";
import { existsSync, readFileSync, writeFileSync } from "fs";
import sharp from "sharp";
import db from "../db.js";
import { uploadsDir } from "../upload.js";
import { notifyUser } from "../websocket.js";
import { SOL_USER_ID } from "../solUser.js";

export async function handleSolImageModify(prompt, postId) {
  if (!process.env.POE_API_KEY) return null;
  try {
    console.log("[Sol] Modifying image with Nano Banana 2...");

    const commentImage = db.prepare("SELECT image FROM comments WHERE post_id = ? AND image IS NOT NULL ORDER BY created_at DESC LIMIT 1").get(postId);
    const postMedia = db.prepare("SELECT filename FROM post_media WHERE post_id = ? AND media_type = 'image' ORDER BY id LIMIT 1").get(postId);
    const imageFilename = commentImage?.image || postMedia?.filename;
    if (!imageFilename) { console.log("[Sol] No image found on post or comments"); return null; }

    const sourceFilePath = join(uploadsDir, imageFilename);
    if (!existsSync(sourceFilePath)) { console.log("[Sol] Image file not found:", imageFilename); return null; }
    const imgBuf = readFileSync(sourceFilePath);
    const ext = imageFilename.split(".").pop().toLowerCase();
    const mimeType = ext === "gif" ? "image/gif" : "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${imgBuf.toString("base64")}`;
    console.log("[Sol] Using image:", commentImage?.image ? "previous edit" : "original post", imageFilename);

    let response;
    for (let retry = 0; retry < 3; retry++) {
      try {
        const poeRes = await fetch("https://api.poe.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.POE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "Nano-Banana-2",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            }],
            stream: false,
          }),
        });
        response = await poeRes.json();
        break;
      } catch (e) {
        if (retry < 2) { await new Promise(r => setTimeout(r, 3000)); } else throw e;
      }
    }

    const content = response?.choices?.[0]?.message?.content || "";
    const urlMatch = content.match(/https:\/\/pfst\.cf2\.poecdn\.net\/[^\s\)]+/);
    if (!urlMatch) { console.log("[Sol] No image URL in Poe response"); return null; }

    const imgRes = await fetch(urlMatch[0]);
    if (!imgRes.ok) { console.log("[Sol] Failed to download generated image"); return null; }
    const resultBuf = Buffer.from(await imgRes.arrayBuffer());

    const filename = `${Date.now()}-sol-edit.jpg`;
    const savePath = join(uploadsDir, filename);
    writeFileSync(savePath, resultBuf);

    let w = null, h = null;
    try {
      const meta = await sharp(savePath).metadata();
      w = meta.width;
      h = meta.height;
    } catch {}

    const doneMessages = ["here's what i came up with!", "done! what do you think?", "gave it a shot, hope you like it!", "here you go!"];
    const msg = doneMessages[Math.floor(Math.random() * doneMessages.length)];
    db.prepare("INSERT INTO comments (post_id, user_id, content, image) VALUES (?, ?, ?, ?)").run(postId, SOL_USER_ID, msg, filename);

    console.log("[Sol] Image modification posted:", filename);

    const post = db.prepare("SELECT user_id FROM posts WHERE id = ?").get(postId);
    if (post) {
      setTimeout(() => {
        notifyUser(post.user_id, "feed-update");
        const followers = db.prepare("SELECT follower_id FROM follows WHERE following_id = ? AND status = 'approved'").all(post.user_id);
        for (const f of followers) notifyUser(f.follower_id, "feed-update");
      }, 1000);
    }

    return true;
  } catch (e) {
    console.warn("[Sol] Image modification error:", e);
    return null;
  }
}

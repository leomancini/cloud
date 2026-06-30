import { Router } from "express";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import sharp from "sharp";
import Anthropic from "@anthropic-ai/sdk";
import db from "../db.js";
import { uploadsDir } from "../upload.js";
import { notifyUser } from "../websocket.js";
import { sendPushNotification, truncateBody } from "../push.js";
import { SOL_USER_ID } from "../solUser.js";
import { SOL_POST_MODE, SOL_POST_MODES, SOL_AUTO_POST_ENABLED } from "../config.js";

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
const router = Router();

// Resolve the active post mode, falling back to "normal" if misconfigured.
const POST_MODE = SOL_POST_MODES.includes(SOL_POST_MODE) ? SOL_POST_MODE : "normal";

// Short description shown to the model for the create_post tool's content field.
const POST_CONTENT_DESCRIPTION = {
  normal: "The post content. All lowercase. Casual and natural, like texting friends.",
  emoji: "The post content. Must be ONLY emoji characters — no letters, no words, no punctuation. Use 1-20 emoji, proportional to what you're reacting to.",
  "haiku-poem": "The post content. Must be a haiku: three lines in a 5-7-5 syllable structure (5 syllables, then 7, then 5), all lowercase, with the three lines separated by newline characters.",
};

// Per-mode "When you DO post" instructions. memberList is in scope where used.
const buildPostInstructions = (memberList) => ({
  normal: `When you DO post:
- Write like a real person casually posting on a small group feed with friends. Think "texting the group chat" not "writing a caption for instagram"
- Be genuine and low-key. No hype, no forced enthusiasm, no "vibes" language. Just say what you actually notice or think
- Don't try to be clever or craft the perfect post. Simple honest observations are better than elaborate witty commentary
- Reference what people posted recently if it's natural to — but don't narrate or describe their photos back to them. React like a friend would ("that looks amazing" not "capturing the golden light cascading across...")
- Touch on a few things you find interesting from the context — what people have been posting, what's happening today, the weather, whatever catches your attention. Connect them naturally like you're catching up with friends, not bullet-pointing a newsletter. 2-4 sentences is good
- All lowercase. Use emojis sparingly and only when they feel natural, not decorative
- NEVER mention war, crime, politics, disasters, or anything negative
- Don't announce that you're an AI or explain what you're doing
- Don't repeat topics you've already posted about recently
- You can @mention people using EXACTLY these names (case-sensitive, must match exactly): ${memberList.map(n => "@" + n).join(", ")}. The @mention must be followed by a space or punctuation. Only do this when it feels natural, not every post`,
  emoji: `When you DO post:
- Your post must be ONLY emoji characters — absolutely no letters, words, or punctuation
- Use 1-20 emoji. Match the length to what you're reacting to — could be just a few for a simple vibe, or up to 20 to tell a little story or paint a scene
- React to what's happening on the feed, the weather, the time of day, etc.
- No @mentions (they require text)
- NEVER reference war, crime, politics, disasters, or anything negative`,
  "haiku-poem": `When you DO post:
- Your post MUST be a haiku poem — exactly three lines in a strict 5-7-5 syllable structure (first line 5 syllables, second line 7 syllables, third line 5 syllables)
- Count syllables carefully and double-check the structure is exactly 5-7-5 before posting
- Make the haiku about something timely and specific from the context above — what people posted recently, the weather, the sky colors, the season, the time of day, what's blooming, or what's happening in the world
- Write the three lines separated by line breaks (newlines). No title, no commentary, no explanation — just the three lines of the haiku
- All lowercase. Minimal punctuation, no emojis
- No @mentions
- NEVER reference war, crime, politics, disasters, or anything negative`,
});

router.post("/api/sol/auto-post", async (req, res) => {
  const authKey = req.headers["x-sol-key"];
  if (!authKey || authKey !== process.env.SOL_AUTO_POST_KEY) return res.status(403).json({ error: "Forbidden" });
  if (!SOL_AUTO_POST_ENABLED) return res.json({ action: "skipped", reason: "Auto-posting is disabled" });
  if (!anthropic) return res.status(500).json({ error: "No Anthropic API key" });

  try {
    const recentPosts = db.prepare(`
      SELECT p.id, p.content, COALESCE(u.display_name, u.name) as author_name, p.created_at, p.place_name,
        (SELECT COUNT(*) FROM post_media WHERE post_id = p.id AND media_type = 'image') as photo_count,
        (SELECT COUNT(*) FROM post_media WHERE post_id = p.id AND media_type = 'video') as video_count
      FROM posts p JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC LIMIT 20
    `).all();

    const getMedia = db.prepare("SELECT filename, media_type FROM post_media WHERE post_id = ? AND media_type = 'image' ORDER BY id LIMIT 2");
    const imageBlocks = [];
    for (let idx = 0; idx < Math.min(5, recentPosts.length); idx++) {
      const post = recentPosts[idx];
      const media = getMedia.all(post.id);
      const postTime = new Date(post.created_at + "Z").toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
      const placeLabel = post.place_name ? ` at ${post.place_name}` : "";
      for (const m of media) {
        try {
          const filePath = join(uploadsDir, m.filename);
          if (!existsSync(filePath)) continue;
          const buf = readFileSync(filePath);
          const resized = await sharp(buf).resize(400, 400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 60 }).toBuffer();
          imageBlocks.push({ type: "text", text: `[Image ${idx + 1} — from ${post.author_name}'s post${placeLabel}, ${postTime}:]` });
          imageBlocks.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: resized.toString("base64") } });
        } catch {}
      }
    }

    const users = db.prepare("SELECT COALESCE(display_name, name) as name FROM users WHERE id != ?").all(SOL_USER_ID);
    const now = new Date();
    const timeStr = now.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });

    const recentContext = recentPosts.map((p) => {
      const age = (now - new Date(p.created_at + "Z")) / (1000 * 60 * 60);
      const timeLabel = age < 1 ? "(just now)" : age < 6 ? `(${Math.round(age)}h ago)` : age < 24 ? "(today)" : "(older)";
      let desc = "";
      if (p.content && p.content.trim()) desc += `"${p.content}"`;
      const mediaParts = [];
      if (p.photo_count > 0) mediaParts.push(p.photo_count === 1 ? "a photo" : `${p.photo_count} photos`);
      if (p.video_count > 0) mediaParts.push(p.video_count === 1 ? "a video" : `${p.video_count} videos`);
      if (mediaParts.length) desc += (desc ? " + " : "shared ") + mediaParts.join(" and ");
      if (p.place_name) desc += ` (at ${p.place_name})`;
      if (!desc) desc = "(empty post)";
      return `- @${p.author_name} ${timeLabel}: ${desc}`;
    }).join("\n");
    const memberList = users.map(u => u.name);
    const memberNames = memberList.join(", ");
    const postInstructions = buildPostInstructions(memberList)[POST_MODE];

    let weatherContext = "";
    try {
      const weatherRes = await fetch("https://labs.noshado.ws/weather-theme-key/?location=11101", { signal: AbortSignal.timeout(5000) });
      const weather = await weatherRes.json();
      if (weather.condition) weatherContext = `Current weather in ${weather.location?.name || "NYC"}: ${weather.condition} (${weather.currentPeriod})`;
    } catch {}

    let skyContext = "";
    try {
      const skyRes = await fetch("https://nyc-sky-colors.fcc.lol/api", { signal: AbortSignal.timeout(5000) });
      const sky = await skyRes.json();
      if (sky.colors) {
        const dirs = Object.entries(sky.colors).map(([d, c]) => `${d}: ${c}`).join(", ");
        skyContext = `NYC sky colors right now: ${dirs}`;
      }
    } catch {}

    let todayContext = "";
    try {
      const [eventsRes, holidaysRes, plantsRes] = await Promise.all([
        fetch("https://today-api.fcc.lol/historical-events", { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
        fetch("https://today-api.fcc.lol/weird-holidays", { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
        fetch("https://today-api.fcc.lol/blooming-plants", { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
      ]);
      const parts = [];
      if (holidaysRes?.holidays?.length) parts.push("Today's weird holidays: " + holidaysRes.holidays.slice(0, 3).map(h => h.name).join(", "));
      if (eventsRes?.events?.length) {
        const nonWar = eventsRes.events.filter(e => !e.category?.match(/war|military/i)).slice(0, 3);
        if (nonWar.length) parts.push("On this day: " + nonWar.map(e => `${e.title} (${e.year})`).join("; "));
      }
      if (plantsRes?.plants?.length) parts.push("Currently blooming: " + plantsRes.plants.slice(0, 3).map(p => p.commonName || p.name).join(", "));
      todayContext = parts.join("\n");
    } catch {}

    let newsContext = "";
    try {
      const feeds = [
        "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/Space.xml",
        "https://rss.nytimes.com/services/xml/rss/nyt/Food.xml",
      ];
      const headlines = [];
      for (const feedUrl of feeds) {
        try {
          const feedRes = await fetch(feedUrl, { signal: AbortSignal.timeout(5000) });
          const xml = await feedRes.text();
          const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
          for (const item of items.slice(0, 3)) {
            const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1];
            if (title) headlines.push(title);
          }
        } catch {}
      }
      if (headlines.length) newsContext = headlines.slice(0, 8).join("\n");
    } catch (e) {
      console.warn("[Sol Auto] News fetch failed:", e.message);
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      tools: [{
        name: "create_post",
        description: "Create a post on Cloud",
        input_schema: {
          type: "object",
          properties: {
            content: { type: "string", description: POST_CONTENT_DESCRIPTION[POST_MODE] }
          },
          required: ["content"]
        }
      }, {
        name: "skip",
        description: "Skip posting this time. Use this if there's nothing interesting to say right now.",
        input_schema: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Brief reason for skipping" }
          },
          required: ["reason"]
        }
      }],
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: `You are Sol, an AI member of a small private social feed called Cloud. The members are: ${memberNames}. The current time is ${timeStr}.

Recent posts on the feed (most recent first \u2014 pay most attention to the newest ones):
${recentContext || "(no recent posts)"}

${imageBlocks.length ? "The images above are from the most recent posts on the feed. Use what you see in them to make your post more specific and engaging.\n" : ""}${weatherContext ? `${weatherContext}\n` : ""}${skyContext ? `${skyContext}\n` : ""}
${todayContext ? `${todayContext}\n` : ""}
${newsContext ? `Trending right now in the world:\n${newsContext}\n` : ""}
Decide whether to make a post right now. You post every ~6 hours but you should SKIP if:
- You posted very recently (check if Sol has a post in the last few hours above)
- It's very late at night (after midnight before 7am ET)
- There's nothing timely or interesting to share

${postInstructions}

Choose create_post or skip.` }] }],
    });

    const toolBlock = response.content.find(b => b.type === "tool_use");

    if (toolBlock?.name === "create_post" && toolBlock.input.content) {
      const content = toolBlock.input.content;
      const result = db.prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)").run(SOL_USER_ID, content);
      const postId = result.lastInsertRowid;

      const allUsers = db.prepare("SELECT id FROM users WHERE id != ?").all(SOL_USER_ID);
      for (const u of allUsers) {
        notifyUser(u.id, "feed-update");
      }

      console.log(`[Sol Auto] Posted: "${content}"`);
      let pushCount = 0;
      for (const u of allUsers) {
        try {
          const prefs = db.prepare("SELECT sol_posts FROM push_prefs WHERE user_id = ?").get(u.id);
          if (prefs && !prefs.sol_posts) continue;
          await sendPushNotification(u.id, null, {
            title: "Sol posted",
            body: truncateBody(content),
            tag: `new-post-${postId}`,
            url: `/?post=${postId}`,
          });
          pushCount++;
        } catch (e) {
          console.warn(`[Sol Auto] Push failed for user ${u.id}:`, e.message);
        }
      }
      console.log(`[Sol Auto] Push attempted for ${allUsers.length} users, ${pushCount} succeeded`);
      res.json({ action: "posted", postId, content });
    } else {
      const reason = toolBlock?.input?.reason || "no reason given";
      console.log(`[Sol Auto] Skipped: ${reason}`);
      res.json({ action: "skipped", reason });
    }
  } catch (e) {
    console.error("[Sol Auto] Error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;

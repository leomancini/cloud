import { Router } from "express";
import { execSync } from "child_process";
import { renameSync } from "fs";
import sharp from "sharp";
import db from "../db.js";
import { upload } from "../upload.js";
import { notifyUser } from "../websocket.js";
import { getUserDisplayName, sendPushNotification } from "../push.js";
import { SOL_USER_ID } from "../solUser.js";
import { handleSolMention } from "../sol/index.js";

const router = Router();

router.post("/api/posts", upload.array("media", 10), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { content, place_name, place_lat, place_lng, place_address, place_maps_url, place_id, og_preview } = req.body;
  if ((!content || !content.trim()) && (!req.files || req.files.length === 0) && !place_name)
    return res.status(400).json({ error: "Content, media, or location required" });

  let ogPreviewJson = null;
  if (og_preview) {
    try {
      const parsed = JSON.parse(og_preview);
      if (parsed && typeof parsed === "object" && (parsed.title || parsed.description || parsed.image)) {
        ogPreviewJson = JSON.stringify(parsed);
      }
    } catch {}
  }

  const result = db
    .prepare(
      "INSERT INTO posts (user_id, content, place_name, place_lat, place_lng, place_address, place_maps_url, place_id, og_preview) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      req.user.id,
      (content || "").trim(),
      place_name || null,
      place_lat || null,
      place_lng || null,
      place_address || null,
      place_maps_url || null,
      place_id || null,
      ogPreviewJson
    );

  const postId = result.lastInsertRowid;

  if (req.files) {
    let mediaSources = {};
    try { if (req.body.media_sources) mediaSources = JSON.parse(req.body.media_sources); } catch {}
    const insertMedia = db.prepare(
      "INSERT INTO post_media (post_id, filename, media_type, source, width, height) VALUES (?, ?, ?, ?, ?, ?)"
    );
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const mediaType = file.mimetype.startsWith("video/") ? "video" : "image";
      let w = null, h = null;
      if (mediaType === "image") {
        const isGif = file.mimetype === "image/gif" || file.originalname?.toLowerCase().endsWith(".gif");
        try {
          if (isGif) {
            const meta = await sharp(file.path, { animated: true }).metadata();
            w = meta.width;
            h = meta.pageHeight || meta.height;
          } else {
            const compressed = await sharp(file.path)
              .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toFile(file.path + ".tmp");
            w = compressed.width;
            h = compressed.height;
            renameSync(file.path + ".tmp", file.path);
          }
        } catch (e) {
          console.warn("Image compression failed:", e);
        }
      } else if (mediaType === "video") {
        try {
          const outPath = file.path + ".mp4";
          execSync(`ffmpeg -y -i "${file.path}" -vf "scale='min(1080,iw)':-2" -c:v libx264 -preset fast -crf 28 -c:a aac -b:a 128k -movflags +faststart "${outPath}" 2>/dev/null`, { timeout: 120000 });
          renameSync(outPath, file.path);
        } catch (e) {
          console.warn("Video compression failed:", e);
        }
        try {
          const probe = execSync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${file.path}"`).toString().trim();
          const [pw, ph] = probe.split(",").map(Number);
          if (pw && ph) { w = pw; h = ph; }
        } catch (e) {
          console.warn("Video probe failed:", e);
        }
      }
      insertMedia.run(postId, file.filename, mediaType, mediaSources[i] || null, w, h);
    }
  }

  const followers = db.prepare("SELECT follower_id FROM follows WHERE following_id = ? AND status = 'approved'").all(req.user.id);
  const mediaFiles = req.files || [];
  const photoCount = mediaFiles.filter((f) => f.mimetype.startsWith("image/")).length;
  const videoCount = mediaFiles.filter((f) => f.mimetype.startsWith("video/")).length;
  let mediaDesc = "";
  if (photoCount && videoCount) mediaDesc = `Shared ${photoCount > 1 ? `${photoCount} photos` : "a photo"} and ${videoCount > 1 ? `${videoCount} videos` : "a video"}`;
  else if (videoCount) mediaDesc = videoCount === 1 ? "Shared a video" : `Shared ${videoCount} videos`;
  else if (photoCount) mediaDesc = photoCount === 1 ? "Shared a photo" : `Shared ${photoCount} photos`;
  for (const f of followers) {
    notifyUser(f.follower_id, "feed-update");
    sendPushNotification(f.follower_id, "new_posts", {
      title: `${getUserDisplayName(req.user.id)} posted`,
      body: (content || "").trim().slice(0, 100) || mediaDesc || "New post",
      tag: `new-post-${postId}`,
      url: `/?post=${postId}`,
    });
  }

  // Push: @mentions in the post body
  const postText = (content || "").trim();
  if (postText) {
    const allUsers = db.prepare("SELECT id, name, display_name FROM users WHERE id != ?").all(req.user.id);
    for (const u of allUsers) {
      const displayName = u.display_name || u.name;
      const mentionPattern = new RegExp(`@(${displayName}|${u.name})(?:[^a-zA-Z0-9]|$)`, "i");
      if (mentionPattern.test(postText) && u.id !== SOL_USER_ID) {
        sendPushNotification(u.id, "mentions", {
          title: `${getUserDisplayName(req.user.id)} mentioned you`,
          body: postText.slice(0, 100),
          tag: `mention-post-${postId}`,
          url: `/?post=${postId}`,
        });
      }
    }
  }

  if ((content || "").toLowerCase().includes("@sol")) {
    handleSolMention(postId, (content || "").trim());
  }

  res.json({ id: postId });
});

router.get("/api/feed", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const limit = 20;
  const offset = parseInt(req.query.offset) || 0;

  const posts = db
    .prepare(
      `SELECT p.id, p.user_id, p.content, p.created_at, p.place_name, p.place_lat, p.place_lng, p.place_address, p.place_maps_url, p.place_id, p.og_preview, p.mini_game,
        COALESCE(u.display_name, u.name) as author_name, '/api/pictures/' || u.id || '.jpg' as author_picture
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id IN (
        SELECT following_id FROM follows WHERE follower_id = ? AND status = 'approved'
      ) OR p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?`
    )
    .all(req.user.id, req.user.id, limit + 1, offset);

  const getMedia = db.prepare(
    "SELECT filename, media_type, source, width, height FROM post_media WHERE post_id = ? ORDER BY id"
  );
  const getComments = db.prepare(
    `SELECT c.id, c.content, c.created_at, c.user_id, c.mini_game, c.image, c.parent_comment_id,
      COALESCE(u.display_name, u.name) as author_name, '/api/pictures/' || u.id || '.jpg' as author_picture
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC`
  );

  const getReactions = db.prepare(
    `SELECT r.emoji, COALESCE(u.display_name, u.name) as user_name, r.user_id
    FROM reactions r
    JOIN users u ON r.user_id = u.id
    WHERE r.post_id = ?
    ORDER BY r.created_at`
  );

  const getCommentReactions = db.prepare(
    `SELECT cr.emoji, cr.user_id, COALESCE(u.display_name, u.name) as name
    FROM comment_reactions cr
    JOIN users u ON u.id = cr.user_id
    WHERE cr.comment_id = ?`
  );

  const hasMore = posts.length > limit;
  if (hasMore) posts.pop();

  const postsWithMedia = posts.map((post) => {
    let ogPreview = null;
    if (post.og_preview) {
      try { ogPreview = JSON.parse(post.og_preview); } catch {}
    }
    return {
    ...post,
    og_preview: ogPreview,
    media: getMedia.all(post.id).map((m) => ({
      url: `/api/uploads/${m.filename}`,
      type: m.media_type,
      source: m.source || null,
      width: m.width || null,
      height: m.height || null,
    })),
    comments: getComments.all(post.id).map((c) => {
      const cReactions = getCommentReactions.all(c.id);
      const grouped = {};
      for (const r of cReactions) {
        if (!grouped[r.emoji]) grouped[r.emoji] = [];
        grouped[r.emoji].push(r.name);
      }
      return {
        ...c,
        comment_reactions: Object.entries(grouped).map(([emoji, names]) => ({
          emoji,
          names,
          user_reacted: cReactions.some((r) => r.emoji === emoji && r.user_id === req.user.id),
        })),
      };
    }),
    reactions: (() => {
      const raw = getReactions.all(post.id);
      const grouped = {};
      for (const r of raw) {
        if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, names: [], user_reacted: 0 };
        grouped[r.emoji].names.push(r.user_name);
        if (r.user_id === req.user.id) grouped[r.emoji].user_reacted = 1;
      }
      return Object.values(grouped);
    })(),
  };
  });

  res.json({ posts: postsWithMedia, hasMore });
});

router.delete("/api/posts/:id", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.user_id !== req.user.id)
    return res.status(403).json({ error: "Not your post" });

  db.prepare("DELETE FROM reactions WHERE post_id = ?").run(post.id);
  db.prepare("DELETE FROM comments WHERE post_id = ?").run(post.id);
  db.prepare("DELETE FROM post_media WHERE post_id = ?").run(post.id);
  db.prepare("DELETE FROM posts WHERE id = ?").run(post.id);
  res.json({ ok: true });
});

export default router;

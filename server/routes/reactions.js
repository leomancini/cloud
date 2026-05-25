import { Router } from "express";
import db from "../db.js";
import { notifyUser } from "../websocket.js";
import { getUserDisplayName, sendPushNotification } from "../push.js";

const router = Router();

const DEFAULT_REACTION_EMOJIS = ["\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83D\uDD25", "\uD83D\uDC4F", "\uD83D\uDE22"];
const VALID_CONTEXTS = ["global", "posts", "comments"];
const MAX_EMOJIS_PER_SET = 12;

// Post reactions
router.post("/api/posts/:id/react", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: "Emoji required" });

  const postId = Number(req.params.id);
  const post = db.prepare("SELECT user_id FROM posts WHERE id = ?").get(postId);
  const existing = db
    .prepare("SELECT id, emoji FROM reactions WHERE post_id = ? AND user_id = ?")
    .get(postId, req.user.id);

  if (existing && existing.emoji === emoji) {
    db.prepare("DELETE FROM reactions WHERE id = ?").run(existing.id);
    res.json({ action: "removed" });
  } else if (existing) {
    db.prepare("UPDATE reactions SET emoji = ? WHERE id = ?").run(emoji, existing.id);
    res.json({ action: "changed", previous: existing.emoji });
  } else {
    db.prepare("INSERT INTO reactions (post_id, user_id, emoji) VALUES (?, ?, ?)").run(
      postId, req.user.id, emoji
    );
    res.json({ action: "added" });
  }
  if (post && post.user_id !== req.user.id) {
    notifyUser(post.user_id, "feed-update");
    sendPushNotification(post.user_id, "reactions", {
      title: `${getUserDisplayName(req.user.id)} reacted ${emoji}`,
      body: "on your post",
      tag: `reaction-${postId}-${req.user.id}`,
      url: `/?post=${postId}`,
    });
  }
});

// Comment reactions
router.post("/api/comments/:id/react", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const commentId = Number(req.params.id);
  const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(commentId);
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  const emoji = req.body?.emoji || "\u2764\uFE0F";
  const existing = db
    .prepare("SELECT id, emoji FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?")
    .get(commentId, req.user.id, emoji);
  const otherReaction = db
    .prepare("SELECT id FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji != ?")
    .get(commentId, req.user.id, emoji);

  if (existing) {
    db.prepare("DELETE FROM comment_reactions WHERE id = ?").run(existing.id);
  } else {
    if (otherReaction) {
      db.prepare("DELETE FROM comment_reactions WHERE id = ?").run(otherReaction.id);
    }
    db.prepare("INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES (?, ?, ?)").run(commentId, req.user.id, emoji);
    if (comment.user_id !== req.user.id) {
      notifyUser(comment.user_id, "feed-update");
      sendPushNotification(comment.user_id, "reactions", {
        title: `${getUserDisplayName(req.user.id)} reacted ${emoji}`,
        body: "on your comment",
        tag: `comment-react-${commentId}-${req.user.id}`,
        url: `/?post=${comment.post_id}&comment=${commentId}`,
      });
    }
  }
  const allReactions = db.prepare("SELECT cr.emoji, COALESCE(u.display_name, u.name) as name, cr.user_id FROM comment_reactions cr JOIN users u ON u.id = cr.user_id WHERE cr.comment_id = ?").all(commentId);
  const grouped = {};
  for (const r of allReactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = [];
    grouped[r.emoji].push(r.name);
  }
  return res.json({
    action: existing ? "removed" : "added",
    comment_reactions: Object.entries(grouped).map(([em, names]) => ({
      emoji: em,
      names,
      user_reacted: allReactions.some((r) => r.emoji === em && r.user_id === req.user.id),
    })),
  });
});

// Reaction preferences
router.get("/api/reaction-prefs", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const rows = db.prepare("SELECT context, emojis FROM reaction_prefs WHERE user_id = ?").all(req.user.id);
  const prefs = { global: DEFAULT_REACTION_EMOJIS, posts: null, comments: null };

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.emojis);
      if (Array.isArray(parsed) && parsed.length > 0) {
        prefs[row.context] = parsed;
      }
    } catch {}
  }

  res.json({ prefs, defaults: DEFAULT_REACTION_EMOJIS });
});

router.put("/api/reaction-prefs/:context", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const { context } = req.params;
  if (!VALID_CONTEXTS.includes(context)) {
    return res.status(400).json({ error: `Invalid context. Must be one of: ${VALID_CONTEXTS.join(", ")}` });
  }

  const { emojis } = req.body;

  if (emojis === null || emojis === undefined || (Array.isArray(emojis) && emojis.length === 0)) {
    db.prepare("DELETE FROM reaction_prefs WHERE user_id = ? AND context = ?").run(req.user.id, context);
    return res.json({ ok: true, emojis: null });
  }

  if (!Array.isArray(emojis)) {
    return res.status(400).json({ error: "emojis must be an array" });
  }

  const cleaned = [...new Set(emojis.filter((e) => typeof e === "string" && e.trim()))].slice(0, MAX_EMOJIS_PER_SET);
  if (cleaned.length === 0) {
    db.prepare("DELETE FROM reaction_prefs WHERE user_id = ? AND context = ?").run(req.user.id, context);
    return res.json({ ok: true, emojis: null });
  }

  db.prepare(`
    INSERT INTO reaction_prefs (user_id, context, emojis, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, context) DO UPDATE SET emojis = excluded.emojis, updated_at = CURRENT_TIMESTAMP
  `).run(req.user.id, context, JSON.stringify(cleaned));

  res.json({ ok: true, emojis: cleaned });
});

export default router;

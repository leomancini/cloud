import { Router } from "express";
import db from "../db.js";
import { notifyUser } from "../websocket.js";
import { getUserDisplayName, sendPushNotification } from "../push.js";
import { SOL_USER_ID } from "../solUser.js";
import { handleSolMention } from "../sol/index.js";

const router = Router();

router.post("/api/posts/:id/comments", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { content, parent_comment_id } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "Content required" });

  const post = db.prepare("SELECT id, user_id FROM posts WHERE id = ?").get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found" });

  let parentId = null;
  if (parent_comment_id) {
    const parent = db.prepare("SELECT id FROM comments WHERE id = ? AND post_id = ?").get(Number(parent_comment_id), post.id);
    if (parent) parentId = parent.id;
  }

  const result = db
    .prepare("INSERT INTO comments (post_id, user_id, content, parent_comment_id) VALUES (?, ?, ?, ?)")
    .run(post.id, req.user.id, content.trim(), parentId);

  if (post.user_id !== req.user.id) {
    notifyUser(post.user_id, "feed-update");
    sendPushNotification(post.user_id, "comments", {
      title: `${getUserDisplayName(req.user.id)} commented`,
      body: content.trim().slice(0, 100),
      tag: `comment-${post.id}-${req.user.id}`,
      url: `/?post=${post.id}&comment=${result.lastInsertRowid}`,
    });
  }

  // Notify parent comment author if this is a reply
  if (parentId) {
    const parentComment = db.prepare("SELECT user_id FROM comments WHERE id = ?").get(parentId);
    if (parentComment && parentComment.user_id !== req.user.id && parentComment.user_id !== post.user_id) {
      notifyUser(parentComment.user_id, "feed-update");
      sendPushNotification(parentComment.user_id, "replies", {
        title: `${getUserDisplayName(req.user.id)} replied to you`,
        body: content.trim().slice(0, 100),
        tag: `reply-${result.lastInsertRowid}`,
        url: `/?post=${post.id}&comment=${result.lastInsertRowid}`,
      });
    }
  }

  // Notify other commenters on this post
  const parentCommentUserId = parentId ? db.prepare("SELECT user_id FROM comments WHERE id = ?").get(parentId)?.user_id : null;
  const previousCommenters = db.prepare(
    `SELECT DISTINCT user_id FROM comments WHERE post_id = ? AND user_id != ? AND user_id != ?`
  ).all(post.id, req.user.id, post.user_id);
  for (const { user_id } of previousCommenters) {
    if (user_id === parentCommentUserId) continue;
    notifyUser(user_id, "feed-update");
    sendPushNotification(user_id, "replies", {
      title: `${getUserDisplayName(req.user.id)} also commented`,
      body: content.trim().slice(0, 100),
      tag: `thread-${post.id}-${req.user.id}`,
      url: `/?post=${post.id}&comment=${result.lastInsertRowid}`,
    });
  }

  if (content.toLowerCase().includes("@sol")) {
    handleSolMention(post.id, content.trim());
  }

  res.json({
    id: result.lastInsertRowid,
    content: content.trim(),
    user_id: req.user.id,
    parent_comment_id: parentId,
    author_name: getUserDisplayName(req.user.id),
    author_picture: `/api/pictures/${req.user.id}.jpg`,
    created_at: new Date().toISOString().replace("T", " ").split(".")[0],
    comment_reactions: [],
  });
});

router.delete("/api/comments/:id", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(req.params.id));
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  const isOwn = comment.user_id === req.user.id;
  const canDeleteSol = comment.user_id === SOL_USER_ID && req.user.email === "leo@leomancinidesign.com";
  if (!isOwn && !canDeleteSol) return res.status(403).json({ error: "Not your comment" });

  db.prepare("DELETE FROM comments WHERE id = ?").run(comment.id);
  res.json({ ok: true });
});

router.put("/api/comments/:id", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "Content required" });

  const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(req.params.id));
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: "Not your comment" });

  db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(content.trim(), comment.id);
  res.json({ ok: true, content: content.trim() });
});

export default router;

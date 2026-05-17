import { Router } from "express";
import db from "../db.js";
import { notifyUser } from "../websocket.js";
import { SOL_USER_ID } from "../solUser.js";

const router = Router();

router.get("/api/users", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const users = db
    .prepare(
      `SELECT u.id, COALESCE(u.display_name, u.name) as name, u.name as google_name, '/api/pictures/' || u.id || '.jpg' as picture,
        (SELECT status FROM follows WHERE follower_id = ? AND following_id = u.id) as follow_status,
        (SELECT status FROM follows WHERE follower_id = u.id AND following_id = ?) as follows_you,
        (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
      FROM users u
      WHERE u.id != ? AND u.id != ?
      ORDER BY post_count DESC, u.created_at DESC`
    )
    .all(req.user.id, req.user.id, req.user.id, SOL_USER_ID);

  res.json({ users: users.map((u) => ({ ...u, is_following: u.follow_status === "approved" ? 1 : 0, follow_status: u.follow_status || null, follows_you: u.follows_you === "approved" })) });
});

router.get("/api/users/:id/profile", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const targetId = parseInt(req.params.id);
  const viewerId = req.user.id;

  const profile = db.prepare(
    `SELECT u.id, COALESCE(u.display_name, u.name) as name, u.name as google_name, '/api/pictures/' || u.id || '.jpg' as picture,
      (SELECT status FROM follows WHERE follower_id = ? AND following_id = u.id) as follow_status,
      (SELECT status FROM follows WHERE follower_id = u.id AND following_id = ?) as follows_you,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id AND status = 'approved') as following_count,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.id AND status = 'approved') as followers_count,
      (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
    FROM users u WHERE u.id = ?`
  ).get(viewerId, viewerId, targetId);

  if (!profile) return res.status(404).json({ error: "User not found" });

  profile.is_following = profile.follow_status === "approved" ? 1 : 0;
  profile.follow_status = profile.follow_status || null;
  profile.follows_you = profile.follows_you === "approved";

  const canViewPosts = targetId === viewerId || profile.follow_status === "approved";
  if (!canViewPosts) return res.json({ profile, posts: [], canViewPosts: false });

  const limit = 20;
  const offset = parseInt(req.query.offset) || 0;

  const posts = db.prepare(
    `SELECT p.id, p.user_id, p.content, p.created_at, p.place_name, p.place_lat, p.place_lng, p.place_address, p.place_maps_url, p.place_id, p.og_preview, p.mini_game,
      COALESCE(u.display_name, u.name) as author_name, '/api/pictures/' || u.id || '.jpg' as author_picture
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?`
  ).all(targetId, limit + 1, offset);

  const getMedia = db.prepare("SELECT filename, media_type, source, width, height FROM post_media WHERE post_id = ? ORDER BY id");
  const getComments = db.prepare(
    `SELECT c.id, c.content, c.created_at, c.user_id, c.mini_game, c.image, c.parent_comment_id,
      COALESCE(u.display_name, u.name) as author_name, '/api/pictures/' || u.id || '.jpg' as author_picture
    FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC`
  );
  const getReactions = db.prepare(
    `SELECT r.emoji, COALESCE(u.display_name, u.name) as user_name, r.user_id
    FROM reactions r JOIN users u ON r.user_id = u.id WHERE r.post_id = ? ORDER BY r.created_at`
  );
  const getCommentReactions = db.prepare(
    `SELECT cr.emoji, cr.user_id, COALESCE(u.display_name, u.name) as name
    FROM comment_reactions cr JOIN users u ON u.id = cr.user_id WHERE cr.comment_id = ?`
  );

  const hasMore = posts.length > limit;
  if (hasMore) posts.pop();

  const postsWithMedia = posts.map((post) => {
    let ogPreview = null;
    if (post.og_preview) { try { ogPreview = JSON.parse(post.og_preview); } catch {} }
    return {
      ...post,
      og_preview: ogPreview,
      media: getMedia.all(post.id).map((m) => ({ url: `/api/uploads/${m.filename}`, type: m.media_type, source: m.source || null, width: m.width || null, height: m.height || null })),
      comments: getComments.all(post.id).map((c) => {
        const cReactions = getCommentReactions.all(c.id);
        const grouped = {};
        for (const r of cReactions) { if (!grouped[r.emoji]) grouped[r.emoji] = []; grouped[r.emoji].push(r.name); }
        return { ...c, comment_reactions: Object.entries(grouped).map(([emoji, names]) => ({ emoji, names, user_reacted: cReactions.some((r) => r.emoji === emoji && r.user_id === viewerId) })) };
      }),
      reactions: (() => {
        const raw = getReactions.all(post.id);
        const grouped = {};
        for (const r of raw) { if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, names: [], user_reacted: 0 }; grouped[r.emoji].names.push(r.user_name); if (r.user_id === viewerId) grouped[r.emoji].user_reacted = 1; }
        return Object.values(grouped);
      })(),
    };
  });

  res.json({ profile, posts: postsWithMedia, hasMore, canViewPosts: true });
});

router.get("/api/users/connections", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const firstDegreeRows = db.prepare(`
    SELECT DISTINCT u.id
    FROM users u
    WHERE u.id != ? AND u.id != ?
      AND EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id AND status = 'approved')
      AND EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = ? AND status = 'approved')
  `).all(req.user.id, SOL_USER_ID, req.user.id, req.user.id);

  const firstDegreeIds = new Set(firstDegreeRows.map((r) => r.id));

  const connectedRows = db.prepare(`
    SELECT DISTINCT u.id
    FROM users u
    WHERE u.id != ? AND u.id != ?
      AND (
        EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id AND status = 'approved')
        OR EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = ? AND status = 'approved')
      )
  `).all(req.user.id, SOL_USER_ID, req.user.id, req.user.id);

  let secondDegreeIds = new Set();
  for (const r of connectedRows) {
    if (!firstDegreeIds.has(r.id)) secondDegreeIds.add(r.id);
  }

  const degrees = {};
  for (const id of firstDegreeIds) degrees[id] = 1;
  for (const id of secondDegreeIds) degrees[id] = 2;

  res.json({ degrees });
});

router.get("/api/followers", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const followers = db
    .prepare(
      `SELECT u.id, COALESCE(u.display_name, u.name) as name, '/api/pictures/' || u.id || '.jpg' as picture,
        (SELECT status FROM follows WHERE follower_id = ? AND following_id = u.id) as follow_status,
        f.status as their_follow_status
      FROM users u
      JOIN follows f ON f.follower_id = u.id
      WHERE f.following_id = ? AND f.status = 'approved' AND u.id != ?
      ORDER BY f.created_at DESC`
    )
    .all(req.user.id, req.user.id, SOL_USER_ID);

  res.json({ followers: followers.map((u) => ({ ...u, is_following: u.follow_status === "approved" ? 1 : 0, follow_status: u.follow_status || null })) });
});

router.get("/api/follow-requests", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const requests = db
    .prepare(
      `SELECT u.id, COALESCE(u.display_name, u.name) as name, '/api/pictures/' || u.id || '.jpg' as picture, f.id as follow_id
      FROM users u
      JOIN follows f ON f.follower_id = u.id
      WHERE f.following_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC`
    )
    .all(req.user.id);

  res.json({ requests });
});

router.post("/api/follow/:id", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const targetId = Number(req.params.id);
  if (targetId === req.user.id)
    return res.status(400).json({ error: "Cannot follow yourself" });

  db.prepare("INSERT OR IGNORE INTO follows (follower_id, following_id, status) VALUES (?, ?, 'pending')").run(
    req.user.id,
    targetId
  );

  notifyUser(targetId, "follow-request");
  res.json({ ok: true, status: "pending" });
});

router.post("/api/follow-requests/:id/approve", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const followerId = Number(req.params.id);
  db.prepare("UPDATE follows SET status = 'approved' WHERE follower_id = ? AND following_id = ? AND status = 'pending'").run(
    followerId, req.user.id
  );
  notifyUser(followerId, "follow-approved");
  res.json({ ok: true });
});

router.post("/api/follow-requests/:id/reject", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const followerId = Number(req.params.id);
  db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'pending'").run(
    followerId, req.user.id
  );
  notifyUser(followerId, "follow-rejected");
  res.json({ ok: true });
});

router.post("/api/unfollow/:id", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(
    req.user.id,
    Number(req.params.id)
  );

  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import webpush from "web-push";
import db from "../db.js";

const router = Router();

router.get("/api/push/vapid-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

router.get("/api/push/prefs", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  let prefs = db.prepare("SELECT * FROM push_prefs WHERE user_id = ?").get(req.user.id);
  if (!prefs) {
    prefs = {
      enabled: 0,
      new_posts: 1,
      mentions: 1,
      reactions: 1,
      comments: 1,
      replies: 1,
      sol_posts: 1,
    };
  }
  res.json({
    enabled:   !!prefs.enabled,
    new_posts: !!prefs.new_posts,
    mentions:  !!prefs.mentions,
    reactions: !!prefs.reactions,
    comments:  !!prefs.comments,
    replies:   !!prefs.replies,
    sol_posts: prefs.sol_posts !== undefined ? !!prefs.sol_posts : true,
  });
});

router.patch("/api/push/prefs", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const allowed = ["enabled", "new_posts", "mentions", "reactions", "comments", "replies", "sol_posts"];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key] ? 1 : 0;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to update" });

  const existing = db.prepare("SELECT id FROM push_prefs WHERE user_id = ?").get(req.user.id);
  if (!existing) {
    db.prepare(`
      INSERT INTO push_prefs (user_id, enabled, new_posts, mentions, reactions, comments, replies, sol_posts)
      VALUES (?, 0, 1, 1, 1, 1, 1, 1)
    `).run(req.user.id);
  }

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE push_prefs SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
    .run(...Object.values(updates), req.user.id);

  res.json({ ok: true });
});

router.post("/api/push/subscribe", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ error: "Invalid subscription object" });

  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
  `).run(req.user.id, endpoint, keys.p256dh, keys.auth);

  const existing = db.prepare("SELECT id FROM push_prefs WHERE user_id = ?").get(req.user.id);
  if (!existing) {
    db.prepare(`
      INSERT INTO push_prefs (user_id, enabled, new_posts, mentions, reactions, comments, replies, sol_posts)
      VALUES (?, 1, 1, 1, 1, 1, 1, 1)
    `).run(req.user.id);
  } else {
    db.prepare("UPDATE push_prefs SET enabled = 1, new_posts = 1, mentions = 1, reactions = 1, comments = 1, replies = 1, sol_posts = 1 WHERE user_id = ?").run(req.user.id);
  }

  res.json({ ok: true });

  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      JSON.stringify({
        title: "Notifications are on",
        body: "You'll be notified of activity in Cloud.",
        tag: "welcome-push",
        url: "/",
      })
    );
  } catch (err) {
    console.warn("Welcome push error:", err.message);
  }
});

router.post("/api/push/unsubscribe", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { endpoint } = req.body;
  if (endpoint) {
    db.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?").run(req.user.id, endpoint);
  } else {
    db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(req.user.id);
  }
  const remaining = db.prepare("SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ?").get(req.user.id);
  if (remaining.c === 0) {
    db.prepare("UPDATE push_prefs SET enabled = 0 WHERE user_id = ?").run(req.user.id);
  }
  res.json({ ok: true });
});

export default router;

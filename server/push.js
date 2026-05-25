import webpush from "web-push";
import db from "./db.js";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "admin@cloud.app"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function getUserDisplayName(userId) {
  const u = db.prepare("SELECT COALESCE(display_name, name) as name FROM users WHERE id = ?").get(userId);
  return u ? u.name : "Someone";
}

async function sendPushNotification(userId, prefKey, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const prefs = db.prepare("SELECT * FROM push_prefs WHERE user_id = ?").get(userId);
  if (!prefs || !prefs.enabled) return;
  if (prefKey && !prefs[prefKey]) return;

  const subs = db.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?").all(userId);
  const message = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        message
      );
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(sub.id);
      } else {
        console.warn("Push send error:", err.message);
      }
    }
  }
}

function truncateBody(text, max = 140) {
  if (!text) return "";
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + "\u2026";
}

export { getUserDisplayName, sendPushNotification, truncateBody };

import "dotenv/config";
import express from "express";
import session from "express-session";
import BetterSqlite3SessionStore from "better-sqlite3-session-store";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, existsSync, writeFileSync, readFileSync, renameSync } from "fs";
import crypto from "crypto";
import multer from "multer";
import sharp from "sharp";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set("trust proxy", 1);
const port = 3127;

// SQLite setup
const db = new Database(join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL,
    following_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id),
    UNIQUE(follower_id, following_id)
  )
`);

// Migration: add status column for existing DBs, default existing follows to approved
try { db.exec("ALTER TABLE follows ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'"); } catch {}

// Uploads directory
const uploadsDir = join(__dirname, "uploads");
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = file.originalname.split(".").pop();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
});

// Profile pictures cache
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

// Session setup
const SqliteStore = BetterSqlite3SessionStore(session);
app.use(
  session({
    store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 86400000 } }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

const callbackURL =
  process.env.BASE_URL
    ? `${process.env.BASE_URL}/api/auth/google/callback`
    : "http://localhost:3127/api/auth/google/callback";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL,
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails[0].value;
      const name = profile.displayName;
      const picture = profile.photos[0]?.value;
      const googleId = profile.id;

      const existing = db
        .prepare("SELECT * FROM users WHERE google_id = ?")
        .get(googleId);

      if (existing) {
        db.prepare(
          "UPDATE users SET email = ?, name = ?, picture = ? WHERE google_id = ?"
        ).run(email, name, picture, googleId);
        if (picture) cachePicture(existing.id, picture);
        return done(null, { ...existing, email, name, picture });
      }

      const result = db
        .prepare(
          "INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)"
        )
        .run(googleId, email, name, picture);

      const newId = result.lastInsertRowid;
      if (picture) cachePicture(newId, picture);

      done(null, {
        id: newId,
        google_id: googleId,
        email,
        name,
        picture,
      });
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  done(null, user || null);
});

app.use(express.json());

// Auth routes
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect(process.env.BASE_URL || "http://localhost:5173");
  }
);

app.get("/api/auth/me", (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      picture: `/api/pictures/${req.user.id}.jpg`,
    },
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.logout(() => {
    res.json({ ok: true });
  });
});

// Profile picture endpoint
app.get("/api/pictures/:id.jpg", (req, res) => {
  const filePath = join(picturesDir, `${req.params.id}.jpg`);
  if (existsSync(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  } else {
    res.status(404).end();
  }
});

// Users & follows routes
app.get("/api/users", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const users = db
    .prepare(
      `SELECT u.id, u.name, '/api/pictures/' || u.id || '.jpg' as picture,
        (SELECT status FROM follows WHERE follower_id = ? AND following_id = u.id) as follow_status,
        (SELECT status FROM follows WHERE follower_id = u.id AND following_id = ?) as follows_you
      FROM users u
      WHERE u.id != ? AND u.id != ?
      ORDER BY u.created_at DESC`
    )
    .all(req.user.id, req.user.id, req.user.id, SOL_USER_ID);

  res.json({ users: users.map((u) => ({ ...u, is_following: u.follow_status === "approved" ? 1 : 0, follow_status: u.follow_status || null, follows_you: u.follows_you === "approved" })) });
});

app.get("/api/followers", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const followers = db
    .prepare(
      `SELECT u.id, u.name, '/api/pictures/' || u.id || '.jpg' as picture,
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

app.get("/api/follow-requests", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const requests = db
    .prepare(
      `SELECT u.id, u.name, '/api/pictures/' || u.id || '.jpg' as picture, f.id as follow_id
      FROM users u
      JOIN follows f ON f.follower_id = u.id
      WHERE f.following_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC`
    )
    .all(req.user.id);

  res.json({ requests });
});

app.post("/api/follow/:id", (req, res) => {
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

app.post("/api/follow-requests/:id/approve", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const followerId = Number(req.params.id);
  db.prepare("UPDATE follows SET status = 'approved' WHERE follower_id = ? AND following_id = ? AND status = 'pending'").run(
    followerId, req.user.id
  );
  notifyUser(followerId, "follow-approved");
  res.json({ ok: true });
});

app.post("/api/follow-requests/:id/reject", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const followerId = Number(req.params.id);
  db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ? AND status = 'pending'").run(
    followerId, req.user.id
  );
  notifyUser(followerId, "follow-rejected");
  res.json({ ok: true });
});

app.post("/api/unfollow/:id", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").run(
    req.user.id,
    Number(req.params.id)
  );

  res.json({ ok: true });
});

// Posts routes
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    place_name TEXT,
    place_lat REAL,
    place_lng REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Add location columns if they don't exist (migration for existing DBs)
try { db.exec("ALTER TABLE posts ADD COLUMN place_name TEXT"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN place_lat REAL"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN place_lng REAL"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN place_address TEXT"); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS post_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    media_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(post_id, user_id, emoji)
  )
`);

// Ensure Sol AI user exists with avatar
const existingClaude = db.prepare("SELECT id FROM users WHERE google_id = 'claude-ai'").get();
const existingSol = db.prepare("SELECT id FROM users WHERE google_id = 'sol-ai'").get();
if (existingClaude && existingSol) {
  // Migrate any comments from old claude user to sol user
  db.prepare("UPDATE comments SET user_id = ? WHERE user_id = ?").run(existingSol.id, existingClaude.id);
  db.prepare("DELETE FROM users WHERE google_id = 'claude-ai'").run();
} else if (existingClaude) {
  db.prepare("UPDATE users SET name = 'Sol', google_id = 'sol-ai', email = 'sol@leo.gd' WHERE google_id = 'claude-ai'").run();
} else if (!existingSol) {
  db.prepare("INSERT INTO users (google_id, email, name) VALUES ('sol-ai', 'sol@leo.gd', 'Sol')").run();
}
const solAvatarPath = join(picturesDir, "sol.jpg");
// Always regenerate Sol avatar
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
writeFileSync(solAvatarPath, solAvatarBuf);
writeFileSync(join(picturesDir, `${SOL_USER_ID}.jpg`), solAvatarBuf);

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

async function handleSolMention(postId) {
  if (!anthropic) return;

  const post = db.prepare("SELECT p.*, u.name as author_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?").get(postId);
  if (!post) return;

  const media = db.prepare("SELECT filename, media_type FROM post_media WHERE post_id = ? ORDER BY id").all(postId);
  const comments = db.prepare(
    "SELECT c.content, u.name as author_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC"
  ).all(postId);

  const content = [];

  // Add images/video frames
  for (const m of media) {
    try {
      const filePath = join(uploadsDir, m.filename);
      if (m.media_type === "image") {
        const buf = readFileSync(filePath);
        const base64 = buf.toString("base64");
        const ext = m.filename.split(".").pop().toLowerCase();
        const mediaType = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
        content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
      } else if (m.media_type === "video") {
        // Extract 3 frames from the video (start, middle, end)
        const tmpDir = join(uploadsDir, ".tmp_frames");
        if (!existsSync(tmpDir)) mkdirSync(tmpDir);
        const duration = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`).toString().trim()) || 1;
        const times = [0, duration / 2, Math.max(0, duration - 0.5)];
        for (const t of times) {
          const framePath = join(tmpDir, `frame_${m.filename}_${t}.jpg`);
          try {
            execSync(`ffmpeg -y -ss ${t} -i "${filePath}" -frames:v 1 -q:v 3 "${framePath}" 2>/dev/null`);
            const buf = readFileSync(framePath);
            content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") } });
            try { execSync(`rm "${framePath}"`); } catch (e) {}
          } catch (e) {}
        }
      }
    } catch (e) {
      console.error("Failed to process media for Sol:", e);
    }
  }

  // Build text context
  let textContext = "";
  if (post.content) textContext += `${post.author_name} posted: "${post.content}"\n\n`;
  if (post.place_name) textContext += `Location: ${post.place_name}\n\n`;
  if (comments.length > 0) {
    textContext += "Comments:\n";
    for (const c of comments) {
      textContext += `- ${c.author_name}: ${c.content}\n`;
    }
    textContext += "\n";
  }
  textContext += "You are Sol, an AI participant in this social feed called Cloud. Write a brief, natural comment responding to this post and its context. Be friendly and conversational. Keep it to 1-2 sentences. Do not use emojis. Always write in all lowercase.";

  content.push({ type: "text", text: textContext });

  // Insert placeholder comment
  const placeholder = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").run(postId, SOL_USER_ID, "thinking...");
  const placeholderId = placeholder.lastInsertRowid;

  // Notify all relevant users about the thinking comment
  notifyUser(post.user_id, "feed-update");
  const postFollowers = db.prepare("SELECT follower_id FROM follows WHERE following_id = ? AND status = 'approved'").all(post.user_id);
  for (const f of postFollowers) notifyUser(f.follower_id, "feed-update");

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content }],
    });

    const reply = response.content[0].text.trim();

    db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(reply, placeholderId);

    // Notify again with the real response
    notifyUser(post.user_id, "feed-update");
    for (const f of postFollowers) notifyUser(f.follower_id, "feed-update");
  } catch (e) {
    console.error("Sol response error:", e);
    db.prepare("UPDATE comments SET content = ? WHERE id = ?").run("Sorry, I couldn't respond right now.", placeholderId);
    notifyUser(post.user_id, "feed-update");
  }
}

app.post("/api/posts", upload.array("media", 10), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { content, place_name, place_lat, place_lng, place_address } = req.body;
  if ((!content || !content.trim()) && (!req.files || req.files.length === 0))
    return res.status(400).json({ error: "Content or media required" });

  const result = db
    .prepare(
      "INSERT INTO posts (user_id, content, place_name, place_lat, place_lng, place_address) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      req.user.id,
      (content || "").trim(),
      place_name || null,
      place_lat || null,
      place_lng || null,
      place_address || null
    );

  const postId = result.lastInsertRowid;

  if (req.files) {
    const insertMedia = db.prepare(
      "INSERT INTO post_media (post_id, filename, media_type) VALUES (?, ?, ?)"
    );
    for (const file of req.files) {
      const mediaType = file.mimetype.startsWith("video/") ? "video" : "image";
      if (mediaType === "image") {
        try {
          await sharp(file.path)
            .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(file.path + ".tmp");
          renameSync(file.path + ".tmp", file.path);
        } catch (e) {
          console.error("Image compression failed:", e);
        }
      }
      insertMedia.run(postId, file.filename, mediaType);
    }
  }

  const followers = db.prepare("SELECT follower_id FROM follows WHERE following_id = ? AND status = 'approved'").all(req.user.id);
  for (const f of followers) notifyUser(f.follower_id, "feed-update");

  if ((content || "").toLowerCase().includes("@sol")) {
    handleSolMention(postId);
  }

  res.json({ id: postId });
});

app.get("/api/feed", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const posts = db
    .prepare(
      `SELECT p.id, p.user_id, p.content, p.created_at, p.place_name, p.place_lat, p.place_lng, p.place_address,
        u.name as author_name, '/api/pictures/' || u.id || '.jpg' as author_picture
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id IN (
        SELECT following_id FROM follows WHERE follower_id = ? AND status = 'approved'
      ) OR p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 50`
    )
    .all(req.user.id, req.user.id);

  const getMedia = db.prepare(
    "SELECT filename, media_type FROM post_media WHERE post_id = ? ORDER BY id"
  );
  const getComments = db.prepare(
    `SELECT c.id, c.content, c.created_at, c.user_id,
      u.name as author_name, '/api/pictures/' || u.id || '.jpg' as author_picture
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC`
  );

  const getReactions = db.prepare(
    `SELECT r.emoji, u.name as user_name, r.user_id
    FROM reactions r
    JOIN users u ON r.user_id = u.id
    WHERE r.post_id = ?
    ORDER BY r.created_at`
  );

  const postsWithMedia = posts.map((post) => ({
    ...post,
    media: getMedia.all(post.id).map((m) => ({
      url: `/api/uploads/${m.filename}`,
      type: m.media_type,
    })),
    comments: getComments.all(post.id),
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
  }));

  res.json({ posts: postsWithMedia });
});

// Serve uploaded media
app.get("/api/uploads/:filename", (req, res) => {
  const filePath = join(uploadsDir, req.params.filename);
  if (existsSync(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  } else {
    res.status(404).end();
  }
});

app.delete("/api/posts/:id", (req, res) => {
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

// Reactions
app.post("/api/posts/:id/react", (req, res) => {
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
  if (post && post.user_id !== req.user.id) notifyUser(post.user_id, "feed-update");
});

// Comments
app.post("/api/posts/:id/comments", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "Content required" });

  const post = db.prepare("SELECT id, user_id FROM posts WHERE id = ?").get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found" });

  const result = db
    .prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
    .run(post.id, req.user.id, content.trim());

  if (post.user_id !== req.user.id) notifyUser(post.user_id, "feed-update");

  if (content.toLowerCase().includes("@sol")) {
    handleSolMention(post.id);
  }

  res.json({
    id: result.lastInsertRowid,
    content: content.trim(),
    user_id: req.user.id,
    author_name: req.user.name,
    author_picture: `/api/pictures/${req.user.id}.jpg`,
    created_at: new Date().toISOString().replace("T", " ").split(".")[0],
  });
});

app.delete("/api/comments/:id", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(req.params.id));
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: "Not your comment" });

  db.prepare("DELETE FROM comments WHERE id = ?").run(comment.id);
  res.json({ ok: true });
});

app.put("/api/comments/:id", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "Content required" });

  const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(Number(req.params.id));
  if (!comment) return res.status(404).json({ error: "Comment not found" });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: "Not your comment" });

  db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(content.trim(), comment.id);
  res.json({ ok: true, content: content.trim() });
});

// Places search proxy
app.get("/api/places/search", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { query, lat, lng } = req.query;
  if (!query) return res.json({ places: [] });

  try {
    const params = new URLSearchParams({
      textQuery: query,
      languageCode: "en",
    });

    const body = {
      textQuery: query,
      languageCode: "en",
      maxResultCount: 5,
    };

    if (lat && lng) {
      body.locationBias = {
        circle: {
          center: { latitude: Number(lat), longitude: Number(lng) },
          radius: 50000,
        },
      };
    }

    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    const places = (data.places || []).map((p) => ({
      name: p.displayName?.text,
      address: p.formattedAddress,
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    }));

    res.json({ places });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Static map cache
const mapsDir = join(__dirname, "maps");
if (!existsSync(mapsDir)) mkdirSync(mapsDir);

app.get("/api/staticmap", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const { lat, lng, zoom = 15, width = 500, height = 150 } = req.query;
  if (!lat || !lng) return res.status(400).end();

  const cacheKey = crypto.createHash("md5").update(`${lat},${lng},${zoom},${width},${height}`).digest("hex");
  const cachePath = join(mapsDir, `${cacheKey}.png`);

  if (existsSync(cachePath)) {
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.send(readFileSync(cachePath));
  }

  try {
    const style = [
      "feature:all|element:geometry|saturation:-100",
      "feature:all|element:labels.icon|visibility:off",
      "feature:poi|element:labels|visibility:off",
      "feature:transit|element:labels|visibility:off",
    ];
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom,
      size: `${width}x${height}`,
      scale: 2,
      markers: `color:red|${lat},${lng}`,
      key: process.env.GOOGLE_PLACES_API_KEY,
    });
    style.forEach((s) => params.append("style", s));
    const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params}`);
    if (!response.ok) return res.status(response.status).end();
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(cachePath, buffer);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch {
    res.status(500).end();
  }
});

// Serve static files from dist
app.use(express.static(join(__dirname, "dist")));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const wsClients = new Map(); // userId -> Set of ws connections

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const userId = Number(url.searchParams.get("userId"));
  if (!userId) return ws.close();

  if (!wsClients.has(userId)) wsClients.set(userId, new Set());
  wsClients.get(userId).add(ws);

  ws.on("close", () => {
    const clients = wsClients.get(userId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) wsClients.delete(userId);
    }
  });
});

function notifyUser(userId, type) {
  const clients = wsClients.get(userId);
  if (clients) {
    const msg = JSON.stringify({ type });
    for (const ws of clients) ws.send(msg);
  }
}

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

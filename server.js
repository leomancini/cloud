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
import { execSync, execFileSync } from "child_process";
import webpush from "web-push";

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

// Push notification preferences table
db.exec(`
  CREATE TABLE IF NOT EXISTS push_prefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 0,
    new_posts INTEGER NOT NULL DEFAULT 1,
    mentions INTEGER NOT NULL DEFAULT 1,
    reactions INTEGER NOT NULL DEFAULT 1,
    comments INTEGER NOT NULL DEFAULT 1,
    replies INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Push subscriptions table (Web Push endpoint + keys)
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

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

// Connection degree endpoint
app.get("/api/users/connections", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  // First-degree: users the current user follows OR who follow the current user (approved)
  const firstDegreeRows = db.prepare(`
    SELECT DISTINCT u.id
    FROM users u
    WHERE u.id != ? AND u.id != ?
      AND (
        EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id AND status = 'approved')
        OR EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = ? AND status = 'approved')
      )
  `).all(req.user.id, SOL_USER_ID, req.user.id, req.user.id);

  const firstDegreeIds = new Set(firstDegreeRows.map((r) => r.id));

  // Second-degree: users connected (follows or followed-by) to any first-degree person,
  // excluding the current user and first-degree people already found
  let secondDegreeIds = new Set();
  if (firstDegreeIds.size > 0) {
    const placeholders = Array.from(firstDegreeIds).map(() => "?").join(",");
    const secondDegreeRows = db.prepare(`
      SELECT DISTINCT u.id
      FROM users u
      WHERE u.id != ? AND u.id != ?
        AND (
          EXISTS (
            SELECT 1 FROM follows
            WHERE follower_id IN (${placeholders}) AND following_id = u.id AND status = 'approved'
          )
          OR EXISTS (
            SELECT 1 FROM follows
            WHERE following_id IN (${placeholders}) AND follower_id = u.id AND status = 'approved'
          )
        )
    `).all(req.user.id, SOL_USER_ID, ...Array.from(firstDegreeIds), ...Array.from(firstDegreeIds));

    for (const r of secondDegreeRows) {
      if (!firstDegreeIds.has(r.id)) secondDegreeIds.add(r.id);
    }
  }

  // Build degree map: userId -> 1 | 2 | null
  const degrees = {};
  for (const id of firstDegreeIds) degrees[id] = 1;
  for (const id of secondDegreeIds) degrees[id] = 2;

  res.json({ degrees });
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
try { db.exec("ALTER TABLE posts ADD COLUMN og_preview TEXT"); } catch {}

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

db.exec(`
  CREATE TABLE IF NOT EXISTS comment_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    emoji TEXT NOT NULL DEFAULT '👍',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(comment_id, user_id, emoji)
  )
`);

// Reaction preferences table — stores custom emoji sets per user, per context
// context: "global" | "posts" | "comments" (extendable)
db.exec(`
  CREATE TABLE IF NOT EXISTS reaction_prefs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    context TEXT NOT NULL DEFAULT 'global',
    emojis TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, context)
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

// Web Push setup — generate VAPID keys once with: npx web-push generate-vapid-keys
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "admin@cloud.app"}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Send a Web Push notification to all subscriptions for a user, gated by their prefs.
// prefKey: one of "new_posts" | "mentions" | "reactions" | "comments" | "replies"
async function sendPushNotification(userId, prefKey, payload) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  const prefs = db.prepare("SELECT * FROM push_prefs WHERE user_id = ?").get(userId);
  // If no prefs row yet, or master toggle off, skip
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
      // 410 Gone / 404 = subscription expired, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(sub.id);
      } else {
        console.error("Push send error:", err.message);
      }
    }
  }
}

const GITHUB_OWNER = "leomancini";
const GITHUB_REPO = "cloud";

const CLASSIFY_TOOLS = [
  {
    name: "post_comment",
    description: "Reply with a conversational comment on the post",
    input_schema: {
      type: "object",
      properties: {
        comment: { type: "string", description: "The comment to post. Must be all lowercase, 1-2 sentences, no emojis." }
      },
      required: ["comment"]
    }
  },
  {
    name: "make_code_change",
    description: "Make a code change to the Cloud app and open a GitHub pull request. Use this when the user is asking to change, add, fix, or build something in the app's code.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Detailed description of what code changes to make" },
        message: { type: "string", description: "A brief comment acknowledging what the user asked for and letting them know you're on it and will comment here when it's ready. Reference the specific request. All lowercase, no emojis." }
      },
      required: ["description", "message"]
    }
  }
];


async function handleSolCodeChange(description) {
  if (!process.env.GITHUB_TOKEN) return null;

  const slug = `sol-${Date.now()}`;
  const branchName = `sol/${slug}`;
  const worktreePath = `/tmp/${slug}`;

  try {
    execFileSync("git", ["worktree", "add", worktreePath, "-b", branchName], { cwd: __dirname });
    console.log(`[Sol] Worktree created at ${worktreePath}`);

    // Agent loop with direct API
    const agentMessages = [{
      role: "user",
      content: `You are Sol, an AI developer making changes to Cloud, a social feed app.

Tech stack: Express backend (server.js), React frontend (src/App.jsx — entire UI in one file), SQLite (better-sqlite3), styled-components, Vite.

Requested change: ${description}

Steps: 1) Read the file(s) you need to change. 2) Use edit_file for targeted replacements. 3) Stop — do not re-read or verify. Get it right the first time.`
    }];

    const agentTools = [
      { name: "read_file", description: "Read a file from the repo", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
      { name: "edit_file", description: "Replace old_string with new_string in a file. old_string must be unique.", input_schema: { type: "object", properties: { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, required: ["path", "old_string", "new_string"] } },
      { name: "write_file", description: "Create a new file or overwrite a small file", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
    ];

    const runTool = (name, input) => {
      const safePath = join(worktreePath, input.path);
      if (!safePath.startsWith(worktreePath + "/")) throw new Error("Path outside repo");
      if (name === "read_file") {
        if (!existsSync(safePath)) return `File not found: ${input.path}`;
        return readFileSync(safePath, "utf-8");
      } else if (name === "edit_file") {
        if (!existsSync(safePath)) return `File not found: ${input.path}`;
        const content = readFileSync(safePath, "utf-8");
        const count = content.split(input.old_string).length - 1;
        if (count === 0) return `Error: old_string not found in ${input.path}`;
        if (count > 1) return `Error: old_string found ${count} times — include more context to make it unique.`;
        writeFileSync(safePath, content.replace(input.old_string, input.new_string));
        return `Edited ${input.path}`;
      } else if (name === "write_file") {
        const dir = dirname(safePath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(safePath, input.content);
        return `Written ${input.path}`;
      }
      return `Unknown tool: ${name}`;
    };

    for (let i = 0; i < 7; i++) {
      console.log(`[Sol] Agent iteration ${i + 1}...`);
      let response;
      for (let retry = 0; retry < 3; retry++) {
        try {
          response = await anthropic.messages.create({ model: "claude-sonnet-4-6", max_tokens: 8192, tools: agentTools, messages: agentMessages });
          break;
        } catch (e) {
          if (e.status === 429 && retry < 2) {
            const wait = (retry + 1) * 60;
            console.log(`[Sol] Rate limited, waiting ${wait}s...`);
            await new Promise(r => setTimeout(r, wait * 1000));
          } else throw e;
        }
      }

      agentMessages.push({ role: "assistant", content: response.content });
      const toolBlocks = response.content.filter(b => b.type === "tool_use");
      if (toolBlocks.length === 0) { console.log("[Sol] Agent done."); break; }

      const results = [];
      for (const block of toolBlocks) {
        console.log(`[Sol] Tool: ${block.name} (${block.input.path})`);
        let result;
        try { result = runTool(block.name, block.input); } catch (e) { result = `Error: ${e.message}`; }
        results.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      agentMessages.push({ role: "user", content: results });
    }

    // Check for changes
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: worktreePath }).toString();
    if (!status.trim()) {
      console.log("[Sol] No changes made.");
      execFileSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: __dirname });
      return null;
    }

    // Commit and push
    execFileSync("git", ["add", "-A"], { cwd: worktreePath });
    execFileSync("git", ["commit", "-m", `sol: ${description.slice(0, 200)}`], { cwd: worktreePath });

    const pushUrl = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`;
    execFileSync("git", ["push", pushUrl, branchName], { cwd: worktreePath });

    // Create PR via GitHub API
    const prRes = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pulls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `sol: ${description.slice(0, 72)}`,
        body: `requested via cloud\n\n> ${description}`,
        head: branchName,
        base: "main",
      }),
    });
    const pr = await prRes.json();
    console.log("[Sol] PR created:", pr.html_url);

    // Clean up worktree
    execFileSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: __dirname });

    return pr.html_url || null;
  } catch (e) {
    console.error("Sol PR error:", e);
    try { execFileSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: __dirname }); } catch {}
    try { execFileSync("git", ["branch", "-D", branchName], { cwd: __dirname }); } catch {}
    return null;
  }
}

async function handleSolMention(postId, triggerText = null) {
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
  if (triggerText) {
    textContext += `The message you are responding to: "${triggerText}"\n\n`;
  }
  textContext += `You are Sol, an AI participant in this social feed called Cloud. Cloud is also the name of the app's codebase. You are powered by Claude Sonnet 4.6 (Anthropic). When making code changes, you also use Claude Sonnet 4.6.

Respond to the most recent message directed at you (above). The post and comment thread are context, but focus on what was just said to you.

Choose one action:
- post_comment: Write a brief, natural comment. Be friendly and conversational. 1-2 sentences. No emojis. Always all lowercase. Use this for casual messages, greetings, questions, or anything that isn't explicitly asking for a code change.
- make_code_change: ONLY use this if the message directed at you is explicitly asking you to change, add, fix, or build something in the app's code. Do not use this for casual conversation even if the surrounding thread mentions code.${!process.env.GITHUB_TOKEN ? " (Currently unavailable — no GitHub token configured)" : ""}`;

  content.push({ type: "text", text: textContext });

  // Insert placeholder comment
  const placeholder = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").run(postId, SOL_USER_ID, "thinking...");
  const placeholderId = placeholder.lastInsertRowid;

  notifyUser(post.user_id, "feed-update");
  const postFollowers = db.prepare("SELECT follower_id FROM follows WHERE following_id = ? AND status = 'approved'").all(post.user_id);
  for (const f of postFollowers) notifyUser(f.follower_id, "feed-update");

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      tools: CLASSIFY_TOOLS,
      tool_choice: { type: "any" },
      messages: [{ role: "user", content }],
    });

    const toolBlock = response.content.find(b => b.type === "tool_use");

    const notify = () => {
      notifyUser(post.user_id, "feed-update");
      for (const f of postFollowers) notifyUser(f.follower_id, "feed-update");
    };

    const solComment = (text) => {
      db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").run(postId, SOL_USER_ID, text);
      notify();
    };

    const updatePlaceholder = (text) => {
      db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(text, placeholderId);
      notify();
    };

    console.log("[Sol] Classified as:", toolBlock?.name || "text");

    if (toolBlock && toolBlock.name === "make_code_change" && process.env.GITHUB_TOKEN) {
      console.log("[Sol] Posting acknowledgment:", toolBlock.input.message);
      updatePlaceholder(toolBlock.input.message);

      const prUrl = await handleSolCodeChange(toolBlock.input.description);
      console.log("[Sol] PR result:", prUrl || "failed");

      if (prUrl) {
        solComment(`i opened a pr for that — ${prUrl}`);
      } else {
        solComment("i tried but couldn't make that change, sorry");
      }
    } else if (toolBlock && toolBlock.name === "post_comment") {
      updatePlaceholder(toolBlock.input.comment);
    } else {
      const textBlock = response.content.find(b => b.type === "text");
      updatePlaceholder(textBlock?.text?.trim() || "hmm, not sure what to say");
    }
  } catch (e) {
    console.error("Sol response error:", e);
    db.prepare("UPDATE comments SET content = ? WHERE id = ?").run("sorry, i couldn't respond right now.", placeholderId);
    notifyUser(post.user_id, "feed-update");
  }
}

app.post("/api/posts", upload.array("media", 10), async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { content, place_name, place_lat, place_lng, place_address, og_preview } = req.body;
  if ((!content || !content.trim()) && (!req.files || req.files.length === 0))
    return res.status(400).json({ error: "Content or media required" });

  // Validate og_preview JSON if provided
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
      "INSERT INTO posts (user_id, content, place_name, place_lat, place_lng, place_address, og_preview) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      req.user.id,
      (content || "").trim(),
      place_name || null,
      place_lat || null,
      place_lng || null,
      place_address || null,
      ogPreviewJson
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
  for (const f of followers) {
    notifyUser(f.follower_id, "feed-update");
    // Push: new post from someone they follow
    sendPushNotification(f.follower_id, "new_posts", {
      title: `${req.user.name} posted`,
      body: (content || "").trim().slice(0, 100) || "Shared a photo",
      tag: `new-post-${postId}`,
      url: "/",
    });
  }

  // Push: @mentions in the post body
  const postText = (content || "").trim();
  if (postText) {
    const allUsers = db.prepare("SELECT id, name FROM users WHERE id != ?").all(req.user.id);
    for (const u of allUsers) {
      const mentionPattern = new RegExp(`@${u.name}(?:[^a-zA-Z0-9]|$)`, "i");
      if (mentionPattern.test(postText) && u.id !== SOL_USER_ID) {
        sendPushNotification(u.id, "mentions", {
          title: `${req.user.name} mentioned you`,
          body: postText.slice(0, 100),
          tag: `mention-post-${postId}`,
          url: "/",
        });
      }
    }
  }

  if ((content || "").toLowerCase().includes("@sol")) {
    handleSolMention(postId, (content || "").trim());
  }

  res.json({ id: postId });
});

app.get("/api/feed", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const posts = db
    .prepare(
      `SELECT p.id, p.user_id, p.content, p.created_at, p.place_name, p.place_lat, p.place_lng, p.place_address, p.og_preview,
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

  const getCommentReactions = db.prepare(
    `SELECT cr.emoji, cr.user_id, u.name
    FROM comment_reactions cr
    JOIN users u ON u.id = cr.user_id
    WHERE cr.comment_id = ?`
  );

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
  if (post && post.user_id !== req.user.id) {
    notifyUser(post.user_id, "feed-update");
    // Push: reaction on their post
    sendPushNotification(post.user_id, "reactions", {
      title: `${req.user.name} reacted ${emoji}`,
      body: "on your post",
      tag: `reaction-${postId}-${req.user.id}`,
      url: "/",
    });
  }
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
    handleSolMention(post.id, content.trim());
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
  const isOwn = comment.user_id === req.user.id;
  const canDeleteSol = comment.user_id === SOL_USER_ID && req.user.email === "leo@leomancinidesign.com";
  if (!isOwn && !canDeleteSol) return res.status(403).json({ error: "Not your comment" });

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

// Comment reactions (thumbs up via double-tap)
app.post("/api/comments/:id/react", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const commentId = Number(req.params.id);
  const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(commentId);
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  const emoji = req.body?.emoji || "❤️";
  const existing = db
    .prepare("SELECT id, emoji FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji = ?")
    .get(commentId, req.user.id, emoji);
  // Check if user has a reaction with a different emoji (for changing)
  const otherReaction = db
    .prepare("SELECT id FROM comment_reactions WHERE comment_id = ? AND user_id = ? AND emoji != ?")
    .get(commentId, req.user.id, emoji);

  if (existing) {
    // Toggle off same emoji
    db.prepare("DELETE FROM comment_reactions WHERE id = ?").run(existing.id);
  } else {
    // Remove any existing reaction by this user (swap to new emoji)
    if (otherReaction) {
      db.prepare("DELETE FROM comment_reactions WHERE id = ?").run(otherReaction.id);
    }
    db.prepare("INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES (?, ?, ?)").run(commentId, req.user.id, emoji);
    if (comment.user_id !== req.user.id) notifyUser(comment.user_id, "feed-update");
  }
  const allReactions = db.prepare("SELECT cr.emoji, u.name, cr.user_id FROM comment_reactions cr JOIN users u ON u.id = cr.user_id WHERE cr.comment_id = ?").all(commentId);
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

// Open Graph metadata fetch
app.get("/api/og", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url required" });

  let parsed;
  try {
    parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(parsed.href, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CloudBot/1.0; +https://cloud.app)",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return res.status(422).json({ error: "URL does not return HTML" });
    }

    // Read up to 200 KB — enough to find <head> tags
    const reader = response.body.getReader();
    let html = "";
    let bytes = 0;
    const limit = 200 * 1024;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      bytes += value.length;
      if (bytes >= limit) { reader.cancel(); break; }
    }

    const decodeEntities = (str) =>
      str
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&mdash;/g, "—")
        .replace(/&ndash;/g, "–")
        .replace(/&hellip;/g, "…")
        .replace(/&rsquo;/g, "\u2019")
        .replace(/&lsquo;/g, "\u2018")
        .replace(/&rdquo;/g, "\u201D")
        .replace(/&ldquo;/g, "\u201C")
        .trim();

    const getMeta = (property) => {
      const ogMatch = html.match(
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
      ) || html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i")
      );
      if (ogMatch) return decodeEntities(ogMatch[1]);
      return null;
    };

    const getMetaName = (name) => {
      const m = html.match(
        new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i")
      ) || html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i")
      );
      if (m) return decodeEntities(m[1]);
      return null;
    };

    const getTitleTag = () => {
      const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return m ? decodeEntities(m[1]) : null;
    };

    const title = getMeta("og:title") || getMetaName("twitter:title") || getTitleTag();
    const description = getMeta("og:description") || getMetaName("description") || getMetaName("twitter:description");
    const image = getMeta("og:image") || getMetaName("twitter:image") || getMetaName("twitter:image:src");
    const siteName = getMeta("og:site_name");
    const ogUrl = getMeta("og:url") || parsed.href;

    // Resolve relative image URL
    let resolvedImage = image;
    if (image && !image.startsWith("http")) {
      try {
        resolvedImage = new URL(image, parsed.origin).href;
      } catch { resolvedImage = null; }
    }

    if (!title && !description && !resolvedImage) {
      return res.status(404).json({ error: "No Open Graph data found" });
    }

    // Proxy image through our server to avoid CORS
    const proxiedImage = resolvedImage ? `/api/og/image?url=${encodeURIComponent(resolvedImage)}` : null;

    res.json({
      url: ogUrl,
      title: title || null,
      description: description || null,
      image: proxiedImage,
      siteName: siteName || parsed.hostname,
    });
  } catch (err) {
    if (err.name === "AbortError") return res.status(504).json({ error: "Request timed out" });
    console.error("OG fetch error:", err.message);
    res.status(502).json({ error: "Failed to fetch URL" });
  }
});

// OG image proxy
app.get("/api/og/image", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).end();
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return res.status(400).end();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(parsed.href, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CloudBot/1.0)" },
      redirect: "follow",
    });
    clearTimeout(timeout);
    const ct = response.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return res.status(422).end();
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).end();
  }
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

// ── Reaction preferences routes ─────────────────────────────────────────────

const DEFAULT_REACTION_EMOJIS = ["❤️", "😂", "😮", "🔥", "👏", "😢"];
const VALID_CONTEXTS = ["global", "posts", "comments"];
const MAX_EMOJIS_PER_SET = 12;

// Get current user's reaction prefs (all contexts)
app.get("/api/reaction-prefs", (req, res) => {
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

// Update reaction prefs for a specific context
app.put("/api/reaction-prefs/:context", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const { context } = req.params;
  if (!VALID_CONTEXTS.includes(context)) {
    return res.status(400).json({ error: `Invalid context. Must be one of: ${VALID_CONTEXTS.join(", ")}` });
  }

  const { emojis } = req.body;

  // null/empty means "reset to global/default"
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

// ── End reaction preferences routes ─────────────────────────────────────────

// ── Push notification routes ────────────────────────────────────────────────

// Expose VAPID public key to the frontend
app.get("/api/push/vapid-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

// Get current user's push preferences
app.get("/api/push/prefs", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  let prefs = db.prepare("SELECT * FROM push_prefs WHERE user_id = ?").get(req.user.id);
  if (!prefs) {
    // Return defaults without creating a row yet
    prefs = {
      enabled: 0,
      new_posts: 1,
      mentions: 1,
      reactions: 1,
      comments: 1,
      replies: 1,
    };
  }
  res.json({
    enabled:   !!prefs.enabled,
    new_posts: !!prefs.new_posts,
    mentions:  !!prefs.mentions,
    reactions: !!prefs.reactions,
    comments:  !!prefs.comments,
    replies:   !!prefs.replies,
  });
});

// Update push preferences (partial update supported)
app.patch("/api/push/prefs", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const allowed = ["enabled", "new_posts", "mentions", "reactions", "comments", "replies"];
  const updates = {};
  for (const key of allowed) {
    if (key in req.body) updates[key] = req.body[key] ? 1 : 0;
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to update" });

  const existing = db.prepare("SELECT id FROM push_prefs WHERE user_id = ?").get(req.user.id);
  if (!existing) {
    // Insert with defaults then apply updates
    db.prepare(`
      INSERT INTO push_prefs (user_id, enabled, new_posts, mentions, reactions, comments, replies)
      VALUES (?, 0, 1, 1, 1, 1, 1)
    `).run(req.user.id);
  }

  const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  db.prepare(`UPDATE push_prefs SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
    .run(...Object.values(updates), req.user.id);

  res.json({ ok: true });
});

// Register (or refresh) a push subscription
app.post("/api/push/subscribe", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ error: "Invalid subscription object" });

  db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
  `).run(req.user.id, endpoint, keys.p256dh, keys.auth);

  // Auto-enable push prefs row if it doesn't exist yet
  const existing = db.prepare("SELECT id FROM push_prefs WHERE user_id = ?").get(req.user.id);
  if (!existing) {
    db.prepare(`
      INSERT INTO push_prefs (user_id, enabled, new_posts, mentions, reactions, comments, replies)
      VALUES (?, 1, 1, 1, 1, 1, 1)
    `).run(req.user.id);
  } else {
    db.prepare("UPDATE push_prefs SET enabled = 1, new_posts = 1, mentions = 1, reactions = 1, comments = 1, replies = 1 WHERE user_id = ?").run(req.user.id);
  }

  res.json({ ok: true });

  // Send a welcome notification
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
    console.error("Welcome push error:", err.message);
  }
});

// Unsubscribe (remove a specific subscription endpoint)
app.post("/api/push/unsubscribe", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { endpoint } = req.body;
  if (endpoint) {
    db.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?").run(req.user.id, endpoint);
  } else {
    // No endpoint supplied — remove all for this user
    db.prepare("DELETE FROM push_subscriptions WHERE user_id = ?").run(req.user.id);
  }
  // Turn off master toggle if no subscriptions remain
  const remaining = db.prepare("SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ?").get(req.user.id);
  if (remaining.c === 0) {
    db.prepare("UPDATE push_prefs SET enabled = 0 WHERE user_id = ?").run(req.user.id);
  }
  res.json({ ok: true });
});

// ── End push notification routes ─────────────────────────────────────────────

// Serve static files from dist (hashed assets get long cache, HTML does not)
app.use(express.static(join(__dirname, "dist"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  }
}));

// SPA fallback
app.get("*", (req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
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

import "dotenv/config";
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, existsSync, writeFileSync } from "fs";

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id) REFERENCES users(id),
    FOREIGN KEY (following_id) REFERENCES users(id),
    UNIQUE(follower_id, following_id)
  )
`);

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
app.use(
  session({
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
        EXISTS(SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
      FROM users u
      WHERE u.id != ?
      ORDER BY u.created_at DESC`
    )
    .all(req.user.id, req.user.id);

  res.json({ users });
});

app.post("/api/follow/:id", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const targetId = Number(req.params.id);
  if (targetId === req.user.id)
    return res.status(400).json({ error: "Cannot follow yourself" });

  db.prepare("INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)").run(
    req.user.id,
    targetId
  );

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

app.post("/api/posts", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { content } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "Content required" });

  const result = db
    .prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)")
    .run(req.user.id, content.trim());

  res.json({ id: result.lastInsertRowid });
});

app.get("/api/feed", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const posts = db
    .prepare(
      `SELECT p.id, p.content, p.created_at,
        u.name as author_name, '/api/pictures/' || u.id || '.jpg' as author_picture
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id IN (
        SELECT following_id FROM follows WHERE follower_id = ?
      ) OR p.user_id = ?
      ORDER BY p.created_at DESC
      LIMIT 50`
    )
    .all(req.user.id, req.user.id);

  res.json({ posts });
});

// Serve static files from dist
app.use(express.static(join(__dirname, "dist")));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

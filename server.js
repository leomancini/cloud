import "dotenv/config";
import express from "express";
import session from "express-session";
import BetterSqlite3SessionStore from "better-sqlite3-session-store";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync, existsSync, writeFileSync } from "fs";
import multer from "multer";

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
    place_name TEXT,
    place_lat REAL,
    place_lng REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Add location columns if they don't exist (migration for existing DBs)
try {
  db.exec("ALTER TABLE posts ADD COLUMN place_name TEXT");
  db.exec("ALTER TABLE posts ADD COLUMN place_lat REAL");
  db.exec("ALTER TABLE posts ADD COLUMN place_lng REAL");
} catch {}

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

app.post("/api/posts", upload.array("media", 10), (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { content, place_name, place_lat, place_lng } = req.body;
  if ((!content || !content.trim()) && (!req.files || req.files.length === 0))
    return res.status(400).json({ error: "Content or media required" });

  const result = db
    .prepare(
      "INSERT INTO posts (user_id, content, place_name, place_lat, place_lng) VALUES (?, ?, ?, ?, ?)"
    )
    .run(
      req.user.id,
      (content || "").trim(),
      place_name || null,
      place_lat || null,
      place_lng || null
    );

  const postId = result.lastInsertRowid;

  if (req.files) {
    const insertMedia = db.prepare(
      "INSERT INTO post_media (post_id, filename, media_type) VALUES (?, ?, ?)"
    );
    for (const file of req.files) {
      const mediaType = file.mimetype.startsWith("video/") ? "video" : "image";
      insertMedia.run(postId, file.filename, mediaType);
    }
  }

  res.json({ id: postId });
});

app.get("/api/feed", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });

  const posts = db
    .prepare(
      `SELECT p.id, p.user_id, p.content, p.created_at, p.place_name, p.place_lat, p.place_lng,
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

  const getMedia = db.prepare(
    "SELECT filename, media_type FROM post_media WHERE post_id = ? ORDER BY id"
  );

  const postsWithMedia = posts.map((post) => ({
    ...post,
    media: getMedia.all(post.id).map((m) => ({
      url: `/api/uploads/${m.filename}`,
      type: m.media_type,
    })),
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

  db.prepare("DELETE FROM post_media WHERE post_id = ?").run(post.id);
  db.prepare("DELETE FROM posts WHERE id = ?").run(post.id);
  res.json({ ok: true });
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

// Static map proxy
app.get("/api/staticmap", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const { lat, lng, zoom = 15, width = 500, height = 150 } = req.query;
  if (!lat || !lng) return res.status(400).end();

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
    res.setHeader("Content-Type", response.headers.get("content-type"));
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = Buffer.from(await response.arrayBuffer());
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

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

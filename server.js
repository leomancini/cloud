import "dotenv/config";
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set("trust proxy", 1);
const port = 3127;

// SQLite setup
const db = new Database(join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

// Create users table
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
        return done(null, { ...existing, email, name, picture });
      }

      const result = db
        .prepare(
          "INSERT INTO users (google_id, email, name, picture) VALUES (?, ?, ?, ?)"
        )
        .run(googleId, email, name, picture);

      done(null, {
        id: result.lastInsertRowid,
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
    res.redirect("/");
  }
);

app.get("/api/auth/me", (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
    },
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.logout(() => {
    res.json({ ok: true });
  });
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

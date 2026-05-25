import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import db from "./db.js";
import { cachePicture } from "./pictures.js";
import { SOL_USER_ID } from "./solUser.js";

const router = Router();

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

      // Auto-follow Sol
      db.prepare("INSERT OR IGNORE INTO follows (follower_id, following_id, status) VALUES (?, ?, 'approved')").run(newId, SOL_USER_ID);
      db.prepare("INSERT OR IGNORE INTO follows (follower_id, following_id, status) VALUES (?, ?, 'approved')").run(SOL_USER_ID, newId);

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

// Auth routes
router.get(
  "/api/auth/google",
  (req, res, next) => {
    if (req.query.redirect) req.session.loginRedirect = req.query.redirect;
    next();
  },
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/api/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    const base = process.env.BASE_URL || "http://localhost:5173";
    const redirect = req.session.loginRedirect;
    delete req.session.loginRedirect;
    res.redirect(redirect ? `${base}${redirect}` : base);
  }
);

router.get("/api/auth/me", (req, res) => {
  if (!req.user) return res.json({ user: null });
  const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const displayName = (fresh?.display_name || fresh?.name || req.user.name);
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: displayName,
      google_name: fresh?.name || req.user.name,
      display_name: fresh?.display_name || null,
      picture: `/api/pictures/${req.user.id}.jpg`,
      game_leaderboard_opt_out: !!fresh?.game_leaderboard_opt_out,
    },
  });
});

router.post("/api/auth/logout", (req, res) => {
  req.logout(() => {
    res.json({ ok: true });
  });
});

router.put("/api/profile/name", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { display_name } = req.body || {};
  const trimmed = (display_name || "").trim() || null;
  db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(trimmed, req.user.id);
  const fresh = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  res.json({ name: fresh.display_name || fresh.name, display_name: fresh.display_name || null });
});

export default router;

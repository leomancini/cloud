import "dotenv/config";
import express from "express";
import session from "express-session";
import BetterSqlite3SessionStore from "better-sqlite3-session-store";
import passport from "passport";
import { createServer } from "http";
import { join } from "path";

import { __dirname, port } from "./server/config.js";
import db from "./server/db.js";
import "./server/solUser.js";
import authRouter from "./server/auth.js";
import usersRouter from "./server/routes/users.js";
import postsRouter from "./server/routes/posts.js";
import commentsRouter from "./server/routes/comments.js";
import reactionsRouter from "./server/routes/reactions.js";
import mediaRouter from "./server/routes/media.js";
import gamesRouter from "./server/routes/games.js";
import listsRouter from "./server/routes/lists.js";
import placesRouter from "./server/routes/places.js";
import pushRouter from "./server/routes/push.js";
import solAutoPostRouter from "./server/sol/autoPost.js";
import { setupWebSocket } from "./server/websocket.js";

const app = express();
app.set("trust proxy", 1);

// Session setup
const SqliteStore = BetterSqlite3SessionStore(session);
app.use(
  session({
    store: new SqliteStore({ client: db, expired: { clear: true, intervalMs: 86400000 } }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // Refresh the session expiry on every request so active users are never
    // logged out. Without this, the expiry is stamped once at login (in both
    // the cookie and the session-store row) and never extended.
    rolling: true,
    cookie: {
      secure: false,
      maxAge: 365 * 24 * 60 * 60 * 1000,
    },
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

// Routes
app.use(authRouter);
app.use(usersRouter);
app.use(postsRouter);
app.use(commentsRouter);
app.use(reactionsRouter);
app.use(mediaRouter);
app.use(gamesRouter);
app.use(listsRouter);
app.use(placesRouter);
app.use(pushRouter);
app.use(solAutoPostRouter);

// Serve static files from dist
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

// HTTP server + WebSocket
const server = createServer(app);
setupWebSocket(server);

server.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

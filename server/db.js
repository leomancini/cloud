import Database from "better-sqlite3";
import { join } from "path";
import { __dirname } from "./config.js";

const db = new Database(join(__dirname, "data.sqlite"));
db.pragma("journal_mode = WAL");

// ── Users ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    display_name TEXT,
    picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
try { db.exec("ALTER TABLE users ADD COLUMN display_name TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN lists_api_key TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN game_leaderboard_opt_out INTEGER NOT NULL DEFAULT 0"); } catch {}

// ── Follows ─────────────────────────────────────────────────────────────────
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
try { db.exec("ALTER TABLE follows ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'"); } catch {}

// ── Push notifications ──────────────────────────────────────────────────────
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
    sol_posts INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);
try { db.exec("ALTER TABLE push_prefs ADD COLUMN sol_posts INTEGER NOT NULL DEFAULT 1"); } catch {}

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

// ── Posts ────────────────────────────────────────────────────────────────────
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
try { db.exec("ALTER TABLE posts ADD COLUMN place_name TEXT"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN place_lat REAL"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN place_lng REAL"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN place_address TEXT"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN place_maps_url TEXT"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN og_preview TEXT"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN mini_game TEXT"); } catch {}
try { db.exec("ALTER TABLE posts ADD COLUMN place_id TEXT"); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS sol_prs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    branch_name TEXT NOT NULL,
    pr_url TEXT,
    pr_number INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS post_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    media_type TEXT NOT NULL,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id)
  )
`);
try { db.exec("ALTER TABLE post_media ADD COLUMN source TEXT"); } catch {}
try { db.exec("ALTER TABLE post_media ADD COLUMN width INTEGER"); } catch {}
try { db.exec("ALTER TABLE post_media ADD COLUMN height INTEGER"); } catch {}

// ── Comments ────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id INTEGER DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id)
  )
`);
try { db.exec("ALTER TABLE comments ADD COLUMN mini_game TEXT"); } catch {}
try { db.exec("ALTER TABLE comments ADD COLUMN image TEXT"); } catch {}
try { db.exec("ALTER TABLE comments ADD COLUMN parent_comment_id INTEGER DEFAULT NULL"); } catch {}

// ── Game scores ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(game_id, user_id)
  )
`);

// ── Reactions ───────────────────────────────────────────────────────────────
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
    emoji TEXT NOT NULL DEFAULT '\u2764\uFE0F',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(comment_id, user_id, emoji)
  )
`);

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

export default db;

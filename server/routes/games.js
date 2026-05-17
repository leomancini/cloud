import { Router } from "express";
import db from "../db.js";

const router = Router();

router.post("/api/games/:gameId/score", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const score = parseInt(req.body.score);
  if (isNaN(score)) return res.status(400).json({ error: "score must be a number" });
  const { gameId } = req.params;
  const existing = db.prepare("SELECT score FROM game_scores WHERE game_id = ? AND user_id = ?").get(gameId, req.user.id);
  if (existing && existing.score >= score) return res.json({ ok: true, updated: false, best: existing.score });
  db.prepare(`
    INSERT INTO game_scores (game_id, user_id, score, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(game_id, user_id) DO UPDATE SET score = excluded.score, updated_at = CURRENT_TIMESTAMP
  `).run(gameId, req.user.id, score);
  res.json({ ok: true, updated: true, best: score });
});

router.get("/api/games/:gameId/leaderboard", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const rows = db.prepare(`
    SELECT gs.score, COALESCE(u.display_name, u.name) as name, '/api/pictures/' || u.id || '.jpg' as picture, u.id as user_id
    FROM game_scores gs JOIN users u ON u.id = gs.user_id
    WHERE gs.game_id = ? AND (u.game_leaderboard_opt_out = 0 OR u.game_leaderboard_opt_out IS NULL)
    ORDER BY gs.score DESC LIMIT 50
  `).all(req.params.gameId);
  res.json({ leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r })) });
});

router.put("/api/profile/game-prefs", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const value = req.body.leaderboard_opt_out ? 1 : 0;
  db.prepare("UPDATE users SET game_leaderboard_opt_out = ? WHERE id = ?").run(value, req.user.id);
  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import db from "../db.js";
import { LISTS_API_URL } from "../config.js";

const router = Router();

router.post("/api/lists/connect", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: "API key required" });
  db.prepare("UPDATE users SET lists_api_key = ? WHERE id = ?").run(apiKey, req.user.id);
  res.json({ ok: true });
});

router.delete("/api/lists/connect", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  db.prepare("UPDATE users SET lists_api_key = NULL WHERE id = ?").run(req.user.id);
  res.json({ ok: true });
});

router.get("/api/lists/status", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const user = db.prepare("SELECT lists_api_key FROM users WHERE id = ?").get(req.user.id);
  res.json({ connected: !!user?.lists_api_key });
});

router.get("/api/lists/pages", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const user = db.prepare("SELECT lists_api_key FROM users WHERE id = ?").get(req.user.id);
  if (!user?.lists_api_key) return res.status(403).json({ error: "Lists account not connected" });
  try {
    const response = await fetch(`${LISTS_API_URL}/pages`, {
      headers: { "X-Api-Key": user.lists_api_key },
    });
    if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch lists" });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/api/lists/save-place/:pageId/:placeId", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const user = db.prepare("SELECT lists_api_key FROM users WHERE id = ?").get(req.user.id);
  if (!user?.lists_api_key) return res.status(403).json({ error: "Lists account not connected" });
  try {
    const response = await fetch(`${LISTS_API_URL}/pages/${req.params.pageId}/items/place/${req.params.placeId}`, {
      method: "POST",
      headers: { "X-Api-Key": user.lists_api_key, "Content-Type": "application/json" },
    });
    if (!response.ok) return res.status(response.status).json({ error: "Failed to save place" });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/api/lists/saved-places", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const user = db.prepare("SELECT lists_api_key FROM users WHERE id = ?").get(req.user.id);
  if (!user?.lists_api_key) return res.status(403).json({ error: "Lists account not connected" });
  try {
    const response = await fetch(`${LISTS_API_URL}/pages/saved-places`, {
      headers: { "X-Api-Key": user.lists_api_key },
    });
    if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch saved places" });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/api/lists/create-page", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const user = db.prepare("SELECT lists_api_key FROM users WHERE id = ?").get(req.user.id);
  if (!user?.lists_api_key) return res.status(403).json({ error: "Lists account not connected" });
  try {
    const response = await fetch(`${LISTS_API_URL}/pages`, {
      method: "POST",
      headers: { "X-Api-Key": user.lists_api_key, "Content-Type": "application/json" },
      body: JSON.stringify({ title: req.body.title, pageType: "locations" }),
    });
    if (!response.ok) return res.status(response.status).json({ error: "Failed to create list" });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/api/lists/remove-item/:pageId/:itemId", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const user = db.prepare("SELECT lists_api_key FROM users WHERE id = ?").get(req.user.id);
  if (!user?.lists_api_key) return res.status(403).json({ error: "Lists account not connected" });
  try {
    const response = await fetch(`${LISTS_API_URL}/pages/${req.params.pageId}/items/${req.params.itemId}`, {
      method: "DELETE",
      headers: { "X-Api-Key": user.lists_api_key },
    });
    if (!response.ok) return res.status(response.status).json({ error: "Failed to remove item" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

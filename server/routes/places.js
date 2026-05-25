import { Router } from "express";
import db from "../db.js";

const router = Router();

router.get("/api/places/search", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not logged in" });
  const { query, lat, lng } = req.query;
  if (!query) return res.json({ places: [] });

  try {
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
            "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    const places = (data.places || []).map((p) => ({
      id: p.id || null,
      name: p.displayName?.text,
      address: p.formattedAddress,
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      maps_url: p.googleMapsUri || null,
    }));

    res.json({ places });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/api/admin/backfill-place-ids", async (req, res) => {
  if (!req.user || req.user.email !== "leo@leomancinidesign.com") return res.status(403).json({ error: "Forbidden" });
  const posts = db.prepare("SELECT id, place_name, place_lat, place_lng FROM posts WHERE place_name IS NOT NULL AND place_id IS NULL").all();
  let updated = 0;
  for (const post of posts) {
    try {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask": "places.id",
        },
        body: JSON.stringify({
          textQuery: post.place_name,
          languageCode: "en",
          maxResultCount: 1,
          ...(post.place_lat && post.place_lng ? { locationBias: { circle: { center: { latitude: post.place_lat, longitude: post.place_lng }, radius: 1000 } } } : {}),
        }),
      });
      const data = await response.json();
      const placeId = data.places?.[0]?.id;
      if (placeId) {
        db.prepare("UPDATE posts SET place_id = ? WHERE id = ?").run(placeId, post.id);
        updated++;
        console.log(`[Backfill] Post ${post.id}: ${post.place_name} \u2192 ${placeId}`);
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.warn(`[Backfill] Failed for post ${post.id}:`, e.message);
    }
  }
  res.json({ total: posts.length, updated });
});

export default router;

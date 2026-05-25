import { Router } from "express";
import { join } from "path";
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "fs";
import crypto from "crypto";
import sharp from "sharp";
import { __dirname } from "../config.js";
import { uploadsDir, upload } from "../upload.js";
import { picturesDir } from "../pictures.js";

const router = Router();

// Serve uploaded media
router.get("/api/uploads/:filename", (req, res) => {
  const filePath = join(uploadsDir, req.params.filename);
  if (existsSync(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  } else {
    res.status(404).end();
  }
});

// Profile picture endpoint
router.get("/api/pictures/:id.jpg", (req, res) => {
  const filePath = join(picturesDir, `${req.params.id}.jpg`);
  if (existsSync(filePath)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.sendFile(filePath);
  } else {
    res.status(404).end();
  }
});

// Prefill media from external apps
router.post("/api/prefill-media", upload.single("image"), async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!req.file) return res.status(400).json({ error: "No image provided" });
  try {
    await sharp(req.file.path)
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(req.file.path + ".tmp");
    renameSync(req.file.path + ".tmp", req.file.path);
  } catch (e) {
    console.warn("Prefill image compression failed:", e);
  }
  res.json({ filename: req.file.filename });
});

router.options("/api/prefill-media", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(204).end();
});

// Open Graph metadata fetch
router.get("/api/og", async (req, res) => {
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
        .replace(/&mdash;/g, "\u2014")
        .replace(/&ndash;/g, "\u2013")
        .replace(/&hellip;/g, "\u2026")
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

    let resolvedImage = image;
    if (image && !image.startsWith("http")) {
      try {
        resolvedImage = new URL(image, parsed.origin).href;
      } catch { resolvedImage = null; }
    }

    if (!title && !description && !resolvedImage) {
      return res.status(404).json({ error: "No Open Graph data found" });
    }

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
    res.status(502).json({ error: "Failed to fetch URL" });
  }
});

// OG image proxy
router.get("/api/og/image", async (req, res) => {
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

// Static map cache
const mapsDir = join(__dirname, "maps");
if (!existsSync(mapsDir)) mkdirSync(mapsDir);

router.get("/api/staticmap", async (req, res) => {
  if (!req.user) return res.status(401).end();
  const { lat, lng, zoom = 15, width = 500, height = 150 } = req.query;
  if (!lat || !lng) return res.status(400).end();

  const cacheKey = crypto.createHash("md5").update(`v4-${lat},${lng},${zoom},${width},${height}`).digest("hex");
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
      key: process.env.GOOGLE_PLACES_API_KEY,
    });
    style.forEach((s) => params.append("style", s));
    const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params}`);
    if (!response.ok) return res.status(response.status).end();
    const mapBuffer = Buffer.from(await response.arrayBuffer());
    const w = parseInt(width) * 2;
    const h = parseInt(height) * 2;
    const dotR = 18;
    const innerR = 7;
    const dot = Buffer.from(
      `<svg width="${w}" height="${h}"><circle cx="${w/2}" cy="${h/2}" r="${dotR}" fill="#000"/><circle cx="${w/2}" cy="${h/2}" r="${innerR}" fill="#fff"/></svg>`
    );
    const buffer = await sharp(mapBuffer).composite([{ input: dot, top: 0, left: 0 }]).png().toBuffer();
    writeFileSync(cachePath, buffer);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch {
    res.status(500).end();
  }
});

export default router;

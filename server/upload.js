import multer from "multer";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { __dirname } from "./config.js";

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
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
});

export { upload, uploadsDir };

/**
 * upload.js — Multer middleware for local event banner uploads.
 * Stores files in /uploads/event-banners with sanitised filenames.
 * Allows: jpg, jpeg, png, webp — max 5 MB.
 */
const multer = require("multer");
const path   = require("path");
const crypto = require("crypto");
const fs     = require("fs");

// Ensure the upload directory exists at startup
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "event-banners");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),

  filename: (_req, file, cb) => {
    // Sanitise: keep only the extension, generate a random hex name
    const ext      = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
    const safeName = crypto.randomBytes(16).toString("hex") + ext;
    cb(null, safeName);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and WebP images are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

module.exports = upload;

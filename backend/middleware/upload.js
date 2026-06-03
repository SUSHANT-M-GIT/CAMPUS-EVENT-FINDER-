/**
 * upload.js — Multer middleware for local file uploads.
 * Handles two fields:
 *   "image"   → /uploads/event-banners/
 *   "qrImage" → /uploads/qr-codes/
 *
 * Allows: jpg, jpeg, png, webp — max 5 MB each.
 */
const multer = require("multer");
const path   = require("path");
const crypto = require("crypto");
const fs     = require("fs");

const BANNER_DIR = path.join(__dirname, "..", "uploads", "event-banners");
const QR_DIR     = path.join(__dirname, "..", "uploads", "qr-codes");

// Ensure upload directories exist at startup
[BANNER_DIR, QR_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Route to the correct sub-directory based on field name
    cb(null, file.fieldname === "qrImage" ? QR_DIR : BANNER_DIR);
  },
  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
    const safeName = crypto.randomBytes(16).toString("hex") + ext;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
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

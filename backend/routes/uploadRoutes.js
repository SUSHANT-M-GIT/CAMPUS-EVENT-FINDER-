/**
 * POST /api/upload/event-image
 * Accepts a multipart file upload, pushes it to Cloudinary,
 * returns the secure URL. Admin-only.
 */
const router = require('express').Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const auth = require('../middleware/auth');
const role = require('../middleware/role');

// Store file in memory (no disk writes) — pass buffer straight to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.post('/event-image', auth, role(['admin']), upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No file provided' });

    // Configure Cloudinary at call-time so dotenv is always loaded first
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Upload buffer to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'campus-events', resource_type: 'image' },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('[Upload] Cloudinary error:', err.message);
    res.status(500).json({ msg: err.message || 'Upload failed' });
  }
});

module.exports = router;

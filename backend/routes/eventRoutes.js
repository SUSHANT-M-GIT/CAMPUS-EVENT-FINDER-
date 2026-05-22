const router = require("express").Router();
const auth   = require("../middleware/auth");
const role   = require("../middleware/role");
const upload = require("../middleware/upload");
const c      = require("../controllers/eventController");

// upload.single("image") handles multipart/form-data with an optional "image" field.
// If no file is sent, multer passes through cleanly — the controller checks req.file.
// multer error handler converts multer errors to clean JSON responses.

function handleMulterError(err, req, res, next) {
  if (err && err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ msg: "File too large. Maximum size is 5 MB." });
  if (err)
    return res.status(400).json({ msg: err.message || "File upload error" });
  next();
}

router.post(  "/", auth, role(["admin"]), upload.single("image"), handleMulterError, c.createEvent);
router.get(   "/", c.getEvents);
router.get(   "/:id", c.getEventById);
router.put(   "/:id", auth, role(["admin"]), upload.single("image"), handleMulterError, c.updateEvent);
router.delete("/:id", auth, role(["admin"]), c.deleteEvent);

module.exports = router;

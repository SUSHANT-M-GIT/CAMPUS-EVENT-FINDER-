const router  = require("express").Router();
const multer  = require("multer");
const path    = require("path");
const auth    = require("../middleware/auth");
const role    = require("../middleware/role");
const c       = require("../controllers/paymentController");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads/payment-screenshots")),
  filename:    (req, file, cb) => cb(null, `pay_${Date.now()}_${Math.random().toString(36).slice(2,8)}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [".jpg",".jpeg",".png",".webp"].includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error("Only JPG/PNG/WebP allowed"), ok);
  },
});
const handleMulterError = (err, req, res, next) => {
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ msg: "Max 5 MB" });
  if (err) return res.status(400).json({ msg: err.message });
  next();
};

// Student — Razorpay online payment
router.post("/create-order/:registrationId",   auth, role(["student"]), c.createRazorpayOrder);
router.post("/verify/:registrationId",         auth, role(["student"]), c.verifyRazorpayPayment);

// Student — manual UPI fallback
router.post("/submit/:registrationId",         auth, role(["student"]), upload.single("screenshot"), handleMulterError, c.submitPayment);
router.get ("/my-status/:eventId",             auth, role(["student"]), c.getMyPaymentStatus);
router.post("/refund/:registrationId",         auth, role(["student"]), c.requestRefund);

// Admin
router.get ("/pending",                        auth, role(["admin"]),   c.getPendingPayments);
router.put ("/approve/:registrationId",        auth, role(["admin"]),   c.approvePayment);
router.put ("/reject/:registrationId",         auth, role(["admin"]),   c.rejectPayment);
router.get ("/refunds/pending",                auth, role(["admin"]),   c.getPendingRefunds);
router.put ("/refund/:registrationId/approve", auth, role(["admin"]),   c.approveRefund);
router.put ("/refund/:registrationId/reject",  auth, role(["admin"]),   c.rejectRefund);

module.exports = router;

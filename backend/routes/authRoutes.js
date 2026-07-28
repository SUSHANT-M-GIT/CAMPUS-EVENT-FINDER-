const router = require("express").Router();
const auth   = require("../middleware/auth");
const c      = require("../controllers/authController");

router.post("/register",      c.register);
router.post("/login",         c.login);
router.post("/verify-email",  c.verifyEmail);
router.post("/resend-otp",    c.resendOtp);
router.post("/google",        c.googleAuth);

// Authenticated users can request admin access
router.post("/request-admin", auth, c.requestAdmin);

module.exports = router;

const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/authController');

router.post('/register', c.register);
router.post('/login', c.login);
router.post('/verify-email', c.verifyEmail);
router.post('/resend-otp', c.resendOtp);
router.post('/forgot-password', c.forgotPassword);
router.post('/reset-password', c.resetPassword);
router.post('/google', c.googleAuth);
router.post('/microsoft', c.microsoftAuth);

// 1-Click Secure Organizer Approval Routes (No user login required — authorized by one-time cryptographic token)
router.get('/organizer-approval/approve/:token', c.handleOrganizerApproval);
router.get('/organizer-approval/reject/:token', c.handleOrganizerRejection);

// Authenticated routes
router.get('/me', auth, c.getCurrentUser);
router.post('/change-password', auth, c.changePassword);

// Authenticated users can request admin access
router.post('/request-admin', auth, c.requestAdmin);

module.exports = router;


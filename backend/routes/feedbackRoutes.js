const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const c = require('../controllers/feedbackController');

// Student submits feedback for a past event they attended
router.post('/:eventId', auth, role(['user', 'student']), c.submitFeedback);

// Student checks if they already submitted feedback
router.get('/:eventId/mine', auth, role(['user', 'student']), c.myFeedback);

// Admin views all feedback for their event
router.get('/:eventId', auth, role(['admin']), c.getEventFeedback);

module.exports = router;

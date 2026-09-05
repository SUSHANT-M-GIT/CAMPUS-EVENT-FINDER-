const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const c = require('../controllers/registrationController');
const team = require('../controllers/teamController');

// Students AND professionals can register, cancel, and view their own registrations
const participantRoles = ['student', 'professional'];
router.post('/register/:eventId', auth, role(participantRoles), c.registerEvent);
router.post('/registrations/:eventId', auth, role(participantRoles), c.registerEvent);
router.delete('/registrations/:eventId', auth, role(participantRoles), c.cancelRegistration);
// Regenerate a missing/broken QR for a registration
router.post(
  '/registrations/:registrationId/regenerate-qr',
  auth,
  role(participantRoles),
  c.regenerateQr
);
router.get('/my-registrations', auth, role(participantRoles), c.myRegistrations);
router.post('/teams/:eventId', auth, role(participantRoles), team.createTeam);
router.post('/teams/:eventId/join', auth, role(participantRoles), team.joinTeam);
router.get('/teams/:eventId/mine', auth, role(participantRoles), team.myTeam);
router.post('/teams/:eventId/leave', auth, role(participantRoles), team.leaveTeam);

// Admin cancellation management
router.get('/cancellations/pending', auth, role(['admin']), c.getPendingCancellations);
router.put('/cancellations/:registrationId/approve', auth, role(['admin']), c.approveCancellation);
router.put('/cancellations/:registrationId/reject', auth, role(['admin']), c.rejectCancellation);

// Admin views registrations for an event
router.get('/event/:id/registrations', auth, role(['admin']), c.eventRegistrations);

module.exports = router;

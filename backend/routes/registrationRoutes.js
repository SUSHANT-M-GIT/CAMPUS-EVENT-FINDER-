const router = require("express").Router();
const auth   = require("../middleware/auth");
const role   = require("../middleware/role");
const c      = require("../controllers/registrationController");

// Students register / cancel / view their own
router.post  ("/register/:eventId",       auth, role(["student"]), c.registerEvent);
router.post  ("/registrations/:eventId",  auth, role(["student"]), c.registerEvent);
router.delete("/registrations/:eventId",  auth, role(["student"]), c.cancelRegistration);
router.get   ("/my-registrations",        auth, role(["student"]), c.myRegistrations);

// Admin cancellation management
router.get   ("/cancellations/pending",                       auth, role(["admin"]), c.getPendingCancellations);
router.put   ("/cancellations/:registrationId/approve",       auth, role(["admin"]), c.approveCancellation);
router.put   ("/cancellations/:registrationId/reject",        auth, role(["admin"]), c.rejectCancellation);

// Admin views registrations for an event
router.get   ("/event/:id/registrations", auth, role(["admin"]),   c.eventRegistrations);

module.exports = router;

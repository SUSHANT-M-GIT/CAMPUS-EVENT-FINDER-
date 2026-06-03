const router = require("express").Router();
const auth   = require("../middleware/auth");
const role   = require("../middleware/role");
const c      = require("../controllers/registrationController");

// Students register / cancel / view their own
router.post  ("/register/:eventId",       auth, role(["student"]), c.registerEvent);
router.post  ("/registrations/:eventId",  auth, role(["student"]), c.registerEvent);
router.delete("/registrations/:eventId",  auth, role(["student"]), c.cancelRegistration);
router.get   ("/my-registrations",        auth, role(["student"]), c.myRegistrations);

// Admin views registrations for an event
router.get   ("/event/:id/registrations", auth, role(["admin"]),   c.eventRegistrations);

module.exports = router;

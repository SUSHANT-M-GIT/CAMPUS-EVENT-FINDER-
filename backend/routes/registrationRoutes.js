const router = require("express").Router();
const auth   = require("../middleware/auth");
const role   = require("../middleware/role");
const c      = require("../controllers/registrationController");

router.post  ("/register/:eventId",       auth, role(["user","student"]), c.registerEvent);
router.post  ("/registrations/:eventId",  auth, role(["user","student"]), c.registerEvent);
router.delete("/registrations/:eventId",  auth, role(["user","student"]), c.cancelRegistration);
router.get   ("/my-registrations",        auth, role(["user","student"]), c.myRegistrations);
router.get   ("/event/:id/registrations", auth, role(["admin"]),          c.eventRegistrations);

module.exports = router;

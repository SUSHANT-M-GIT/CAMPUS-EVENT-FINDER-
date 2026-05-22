const router = require("express").Router();
const auth   = require("../middleware/auth");
const role   = require("../middleware/role");
const c      = require("../controllers/adminController");

// All routes require a valid JWT + admin role
router.get ("/requests",    auth, role(["admin"]), c.listRequests);
router.put ("/approve/:id", auth, role(["admin"]), c.approveAdmin);
router.put ("/reject/:id",  auth, role(["admin"]), c.rejectAdmin);

module.exports = router;

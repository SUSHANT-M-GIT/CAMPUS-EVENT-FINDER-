const router = require("express").Router();
const auth   = require("../middleware/auth");
const c      = require("../controllers/commentController");

// Anyone logged in can read and post comments; deletion is guarded in the controller
router.get   ("/:eventId",     auth, c.getComments);
router.post  ("/:eventId",     auth, c.addComment);
router.delete("/:commentId",   auth, c.deleteComment);

module.exports = router;

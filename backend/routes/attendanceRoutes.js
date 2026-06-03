/**
 * attendanceRoutes.js
 * QR attendance scanning, certificate download.
 */
const router = require("express").Router();
const auth   = require("../middleware/auth");
const role   = require("../middleware/role");
const c      = require("../controllers/attendanceController");

// Student routes
router.get("/my-qr/:registrationId",         auth, role(["student"]),        c.getMyQr);
router.get("/certificate/:registrationId",   auth, role(["student"]),        c.downloadCertificate);

// Admin routes
router.post("/scan",                         auth, role(["admin"]),          c.scanAttendance);
router.get("/:eventId",                      auth, role(["admin"]),          c.getAttendance);
router.put("/:eventId/enable-certificates",  auth, role(["admin"]),          c.enableCertificates);

module.exports = router;

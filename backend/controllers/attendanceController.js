/**
 * attendanceController.js
 * QR-based attendance scanning + certificate PDF generation.
 */
const crypto       = require("crypto");
const PDFDocument  = require("pdfkit");
const Registration = require("../models/Registration");
const Event        = require("../models/Event");
const User         = require("../models/User");
const { sendEmail } = require("../services/emailService");

// ── SCAN QR (admin marks student present) ────────────────────────────────────
// POST /api/attendance/scan
// Body: { registrationId, eventId }
exports.scanAttendance = async (req, res) => {
  try {
    const { registrationId, eventId } = req.body;
    if (!registrationId) return res.status(400).json({ msg: "registrationId is required" });

    const reg = await Registration.findById(registrationId).populate("eventId").populate("userId", "name email");
    if (!reg) return res.status(404).json({ msg: "Registration not found" });

    // Verify this registration belongs to the event being scanned
    const regEventId = reg.eventId?._id?.toString() || reg.eventId?.toString();
    if (eventId && regEventId !== eventId.toString())
      return res.status(400).json({ msg: "QR code does not belong to this event" });

    // Verify admin owns this event
    const event = reg.eventId;
    if (event?.createdBy?.toString() !== req.user.id)
      return res.status(403).json({ msg: "You are not the organizer of this event" });

    if (reg.attendanceStatus === "present")
      return res.status(400).json({ msg: "⚠ Attendance already marked for this student", alreadyScanned: true });

    reg.attendanceStatus = "present";
    await reg.save();

    // Notify via socket
    if (global.io) {
      global.io.to(reg.userId._id?.toString() || reg.userId.toString()).emit("attendanceMarked", {
        eventTitle: event?.title,
        message:    `✅ Attendance marked for "${event?.title}"`,
      });
    }

    res.json({
      msg:     `✅ Attendance marked for ${reg.userId?.name || reg.name}`,
      student: reg.userId?.name || reg.name,
      event:   event?.title,
    });
  } catch (e) {
    console.error("scanAttendance error:", e.message);
    res.status(500).json({ msg: e.message });
  }
};

// ── GET ATTENDANCE LIST (admin) ───────────────────────────────────────────────
// GET /api/attendance/:eventId
exports.getAttendance = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId).lean();
    if (!event) return res.status(404).json({ msg: "Event not found" });
    if (event.createdBy?.toString() !== req.user.id)
      return res.status(403).json({ msg: "Access denied" });

    const regs = await Registration.find({
      eventId: req.params.eventId,
      status:  "confirmed",
    })
      .populate("userId", "name email collegeName")
      .lean();

    res.json(regs.map(r => ({
      _id:              r._id,
      studentName:      r.userId?.name || r.name,
      studentEmail:     r.userId?.email,
      collegeName:      r.userId?.collegeName || r.collegeName,
      attendanceStatus: r.attendanceStatus,
      certificateId:    r.certificateId,
    })));
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── ENABLE CERTIFICATES (admin) ───────────────────────────────────────────────
// PUT /api/attendance/:eventId/enable-certificates
exports.enableCertificates = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    if (event.createdBy?.toString() !== req.user.id)
      return res.status(403).json({ msg: "Access denied" });

    event.certificatesEnabled = true;
    await event.save();

    // Pre-assign certificateIds to all present students
    const presentRegs = await Registration.find({
      eventId: req.params.eventId,
      attendanceStatus: "present",
      certificateId: "",
    });

    for (const reg of presentRegs) {
      reg.certificateId = `CERT-${event._id.toString().slice(-6).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      await reg.save();
    }

    res.json({ msg: `Certificates enabled. ${presentRegs.length} student(s) assigned certificate IDs.` });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── DOWNLOAD CERTIFICATE (student) ───────────────────────────────────────────
// GET /api/attendance/certificate/:registrationId
exports.downloadCertificate = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId)
      .populate("eventId")
      .populate("userId", "name email");

    if (!reg) return res.status(404).json({ msg: "Registration not found" });

    // Ownership check
    const ownerId = reg.userId?._id?.toString() || reg.userId?.toString();
    if (ownerId !== req.user.id)
      return res.status(403).json({ msg: "Access denied" });

    if (reg.attendanceStatus !== "present")
      return res.status(400).json({ msg: "Certificate is only available for students who attended the event" });

    const event = reg.eventId;
    if (!event?.certificatesEnabled)
      return res.status(400).json({ msg: "Certificate generation has not been enabled for this event yet" });

    // Assign certificateId if missing
    if (!reg.certificateId) {
      reg.certificateId = `CERT-${event._id.toString().slice(-6).toUpperCase()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      await reg.save();
    }

    const studentName  = reg.userId?.name  || reg.name  || "Student";
    const eventTitle   = event.title       || "Event";
    const eventDate    = event.date
      ? new Date(event.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const certId       = reg.certificateId;
    const orgAdmin     = await User.findById(event.createdBy, "name").lean();
    const organizerName = orgAdmin?.name || "Campus Event Finder";

    // ── Generate PDF ──────────────────────────────────────────────────────────
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certificate-${certId}.pdf"`);
    doc.pipe(res);

    const W = 841.89, H = 595.28;

    // Background gradient effect using rectangles
    doc.rect(0, 0, W, H).fill("#0f172a");
    doc.rect(0, 0, W, 8).fill("#4f46e5");
    doc.rect(0, H - 8, W, 8).fill("#4f46e5");
    doc.rect(0, 0, 8, H).fill("#4f46e5");
    doc.rect(W - 8, 0, 8, H).fill("#4f46e5");

    // Inner decorative border
    doc.rect(24, 24, W - 48, H - 48).lineWidth(1).stroke("#4f46e5");

    // Logo / icon area
    doc.circle(W / 2, 90, 38).fill("#4f46e5");
    doc.font("Helvetica-Bold").fontSize(28).fillColor("#ffffff").text("🎓", W / 2 - 16, 74);

    // Certificate of Participation heading
    doc.font("Helvetica").fontSize(13).fillColor("#a5b4fc")
      .text("CERTIFICATE OF PARTICIPATION", 0, 148, { align: "center" });

    // "This is to certify that"
    doc.font("Helvetica").fontSize(14).fillColor("#94a3b8")
      .text("This is to certify that", 0, 182, { align: "center" });

    // Student name
    doc.font("Helvetica-Bold").fontSize(38).fillColor("#e2e8f0")
      .text(studentName, 0, 204, { align: "center" });

    // Underline effect
    const nameWidth = Math.min(doc.widthOfString(studentName, { fontSize: 38 }), W - 200);
    doc.moveTo(W / 2 - nameWidth / 2, 256).lineTo(W / 2 + nameWidth / 2, 256).lineWidth(2).stroke("#4f46e5");

    // Participation text
    doc.font("Helvetica").fontSize(14).fillColor("#94a3b8")
      .text("has successfully participated in", 0, 268, { align: "center" });

    // Event title
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#818cf8")
      .text(eventTitle, 60, 292, { align: "center", width: W - 120 });

    // Date
    doc.font("Helvetica").fontSize(12).fillColor("#64748b")
      .text(`held on ${eventDate}`, 0, 330, { align: "center" });

    // Horizontal divider
    doc.moveTo(120, 380).lineTo(W - 120, 380).lineWidth(0.5).stroke("#334155");

    // Organizer signature area
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#e2e8f0")
      .text(organizerName, 160, 396, { width: 180, align: "center" });
    doc.font("Helvetica").fontSize(10).fillColor("#64748b")
      .text("Event Organizer", 160, 414, { width: 180, align: "center" });

    // Certificate ID
    doc.font("Helvetica").fontSize(10).fillColor("#475569")
      .text(`Certificate ID: ${certId}`, W - 320, 396, { width: 200, align: "center" });
    doc.font("Helvetica").fontSize(9).fillColor("#334155")
      .text("Campus Event Finder", W - 320, 412, { width: 200, align: "center" });

    // Footer
    doc.font("Helvetica").fontSize(9).fillColor("#334155")
      .text("Issued by Campus Event Finder Platform", 0, H - 38, { align: "center" });

    doc.end();
  } catch (e) {
    console.error("downloadCertificate error:", e.message);
    if (!res.headersSent) res.status(500).json({ msg: e.message });
  }
};

// ── GET MY QR CODE (student) ──────────────────────────────────────────────────
// GET /api/attendance/my-qr/:registrationId
exports.getMyQr = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId).lean();
    if (!reg) return res.status(404).json({ msg: "Registration not found" });

    const ownerId = reg.userId?.toString();
    if (ownerId !== req.user.id) return res.status(403).json({ msg: "Access denied" });

    res.json({
      attendanceQr:     reg.attendanceQr     || null,
      attendanceStatus: reg.attendanceStatus || "absent",
      certificateId:    reg.certificateId    || null,
    });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

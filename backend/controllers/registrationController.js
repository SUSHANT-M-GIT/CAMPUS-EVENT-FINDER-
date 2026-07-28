const Registration = require("../models/Registration");
const Event        = require("../models/Event");
const User         = require("../models/User");
const QRCode       = require("qrcode");
const crypto       = require("crypto");
const {
  sendConfirmationEmail,
  sendAdminRegistrationAlert,
  sendWaitlistConfirmEmail,
  sendWaitlistPromotedEmail,
  sendEmail,
} = require("../services/emailService");

/** Generate a short unique registration code like REG-A1B2C3 */
function makeRegCode() {
  return "REG-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

// ── REGISTER (or join waitlist) ───────────────────────────────────────────────
exports.registerEvent = async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event || event.registrationDeadline < new Date())
    return res.status(400).json({ msg: "Closed" });

  // College restriction check
  let studentDoc = null;
  if (event.eligibility === "own_college") {
    const adminDoc = await User.findById(event.createdBy).lean();
    studentDoc     = await User.findById(req.user.id).lean();
    const adminCollege   = (adminDoc?.collegeName   || "").trim().toLowerCase();
    const studentCollege = (studentDoc?.collegeName || "").trim().toLowerCase();
    const adminCollegeDisplay = adminDoc?.collegeName?.trim() || "the organising college";
    if (!adminCollege || !studentCollege || adminCollege !== studentCollege) {
      return res.status(403).json({
        msg: `This event is only open to students from ${adminCollegeDisplay}. You are registered under "${studentDoc?.collegeName?.trim() || "an unknown college"}".`
      });
    }
  }
  if (!studentDoc) studentDoc = await User.findById(req.user.id).lean();

  try {
    const { name, collegeId, department } = req.body;
    const isFull = event.maxRegistrations && event.registrationCount >= event.maxRegistrations;

    let status           = "confirmed";
    let waitlistPosition = null;

    if (isFull) {
      // Count existing waitlisted entries to assign next position
      const waitlistCount = await Registration.countDocuments({
        eventId: event._id,
        status:  "waitlisted",
      });
      status           = "waitlisted";
      waitlistPosition = waitlistCount + 1;
    }

    const reg = await new Registration({
      userId: req.user.id,
      eventId: req.params.eventId,
      name, collegeId,
      collegeName: studentDoc?.collegeName || "",
      department,
      status,
      waitlistPosition,
      paymentStatus: event.isPaid ? "pending" : "free",
      registrationCode: makeRegCode(),
    }).save();

    // Generate attendance QR for ALL free confirmed registrations
    // (paid events get QR on payment approval)
    if (status === "confirmed" && !event.isPaid) {
      try {
        const qrPayload = JSON.stringify({
          registrationId:   reg._id.toString(),
          registrationCode: reg.registrationCode,
          eventId:          event._id.toString(),
          studentName:      name,
        });
        reg.attendanceQr = await QRCode.toDataURL(qrPayload, { width: 256, margin: 2 });
        await reg.save();
      } catch (qrErr) {
        console.error("[QR] Generation failed:", qrErr.message);
      }
    }

    // Only increment registrationCount for confirmed registrations
    if (status === "confirmed") {
      await Event.findByIdAndUpdate(req.params.eventId, { $inc: { registrationCount: 1 } });
    }

    res.json({
      msg: status === "waitlisted"
        ? `Event is full. You've been added to the waitlist at position #${waitlistPosition}.`
        : event.isPaid
          ? "Registration submitted. Please complete payment to confirm your spot."
          : "Registered",
      status,
      waitlistPosition,
      paymentStatus: event.isPaid ? "pending" : "free",
      isPaid: event.isPaid,
      registrationId: reg._id,
    });

    // Fire-and-forget emails
    (async () => {
      try {
        const userDoc = await User.findById(req.user.id).lean();
        const recipientEmail = (userDoc?.email || "").trim();
        const recipientName  = userDoc?.name || name || "there";
        if (!recipientEmail) return;

        if (status === "confirmed") {
          await sendConfirmationEmail(recipientEmail, event, {
            name: recipientName,
            attendanceQr:     reg.attendanceQr     || "",
            registrationCode: reg.registrationCode || "",
          });
          // Alert admin
          const adminDoc = await User.findById(event.createdBy).lean();
          if (adminDoc?.email) {
            const updatedEvent = await Event.findById(event._id).lean();
            await sendAdminRegistrationAlert(adminDoc.email, updatedEvent || event, {
              name: recipientName, email: recipientEmail,
              collegeName: userDoc?.collegeName || "",
              department: req.body.department || "",
              collegeId:  req.body.collegeId  || "",
            });
          }
        } else {
          await sendWaitlistConfirmEmail(recipientEmail, event, { name: recipientName, waitlistPosition });
        }
      } catch (err) {
        console.error("[Email] Post-registration error:", err.message);
      }
    })();

  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ msg: "You are already registered for this event." });
    res.status(500).send("error");
  }
};

// ── CANCEL REGISTRATION ───────────────────────────────────────────────────────
exports.cancelRegistration = async (req, res) => {
  try {
    const reg = await Registration.findOne({ userId: req.user.id, eventId: req.params.eventId });
    if (!reg) return res.status(404).json({ msg: "Registration not found" });

    const wasConfirmed      = reg.status === "confirmed";
    const cancelledPosition = reg.waitlistPosition;

    await Registration.findByIdAndDelete(reg._id);

    if (wasConfirmed) {
      await Event.findByIdAndUpdate(req.params.eventId, { $inc: { registrationCount: -1 } });

      // Promote next waitlisted person
      const next = await Registration.findOne({ eventId: req.params.eventId, status: "waitlisted", waitlistPosition: 1 });
      if (next) {
        next.status = "confirmed"; next.waitlistPosition = null;
        const event = await Event.findById(req.params.eventId).lean();
        if (event?.isPaid) {
          next.paymentStatus = "pending";
        } else {
          try {
            const qrPayload = JSON.stringify({ registrationId: next._id.toString(), registrationCode: next.registrationCode || "", eventId: req.params.eventId });
            next.attendanceQr = await QRCode.toDataURL(qrPayload, { width: 256, margin: 2 });
          } catch {}
          await Event.findByIdAndUpdate(req.params.eventId, { $inc: { registrationCount: 1 } });
        }
        await next.save();
        await Registration.updateMany({ eventId: req.params.eventId, status: "waitlisted" }, { $inc: { waitlistPosition: -1 } });
        // Notify promoted student
        (async () => {
          try {
            const userDoc = await User.findById(next.userId).lean();
            const event = await Event.findById(req.params.eventId).lean();
            if (userDoc?.email && event) await sendWaitlistPromotedEmail(userDoc.email, event, { name: next.name || userDoc.name || "there" });
          } catch (err) { console.error("[Waitlist]", err.message); }
        })();
      }
    } else {
      if (cancelledPosition) {
        await Registration.updateMany(
          { eventId: req.params.eventId, status: "waitlisted", waitlistPosition: { $gt: cancelledPosition } },
          { $inc: { waitlistPosition: -1 } }
        );
      }
    }

    res.json({ msg: "Registration cancelled." });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── GET PENDING CANCELLATION REQUESTS (admin) ─────────────────────────────────
// GET /api/registrations/cancellations/pending
exports.getPendingCancellations = async (req, res) => {
  try {
    const regs = await Registration.find({ cancellationStatus: "requested" })
      .populate("userId", "name email collegeName")
      .populate("eventId", "title date price isPaid")
      .sort({ registeredAt: -1 })
      .lean();
    res.json(regs);
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── APPROVE CANCELLATION (admin) ──────────────────────────────────────────────
// PUT /api/registrations/cancellations/:registrationId/approve
exports.approveCancellation = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId)
      .populate("eventId").populate("userId", "name email");
    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.cancellationStatus !== "requested")
      return res.status(400).json({ msg: "No pending cancellation request" });

    const eventId = reg.eventId._id || reg.eventId;

    // Delete the registration and decrement count
    await Registration.findByIdAndDelete(reg._id);
    await Event.findByIdAndUpdate(eventId, { $inc: { registrationCount: -1 } });

    // Promote next waitlisted person
    const next = await Registration.findOne({ eventId, status: "waitlisted", waitlistPosition: 1 });
    if (next) {
      next.status = "confirmed"; next.waitlistPosition = null;
      const event = await Event.findById(eventId).lean();
      if (event?.isPaid) { next.paymentStatus = "pending"; }
      else {
        try {
          const qrPayload = JSON.stringify({ registrationId: next._id.toString(), registrationCode: next.registrationCode, eventId: eventId.toString() });
          next.attendanceQr = await QRCode.toDataURL(qrPayload, { width: 256, margin: 2 });
        } catch {}
        await Event.findByIdAndUpdate(eventId, { $inc: { registrationCount: 1 } });
      }
      await next.save();
      await Registration.updateMany({ eventId, status: "waitlisted" }, { $inc: { waitlistPosition: -1 } });
    }

    // Notify student
    const email = reg.userId?.email;
    const name  = reg.userId?.name || "there";
    if (email) {
      sendEmail({
        to: email,
        subject: `Cancellation Approved: ${reg.eventId?.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
  <div style="background:#4f46e5;padding:20px 24px;color:#fff;"><h2 style="margin:0;">Cancellation Confirmed</h2></div>
  <div style="padding:24px;"><p>Hi <strong>${name}</strong>,</p>
  <p>Your cancellation request for <strong>${reg.eventId?.title}</strong> has been approved.</p>
  <p style="color:#888;font-size:0.8rem;margin-top:24px;">Campus Event Finder</p></div></div>`,
      }).catch(() => {});
    }

    if (global.io) {
      global.io.to(reg.userId._id?.toString() || reg.userId.toString()).emit("cancellationApproved", {
        eventTitle: reg.eventId?.title,
        message: `Your cancellation for "${reg.eventId?.title}" has been approved.`,
      });
    }

    res.json({ msg: "Cancellation approved. Student notified." });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── REJECT CANCELLATION (admin) ───────────────────────────────────────────────
// PUT /api/registrations/cancellations/:registrationId/reject
exports.rejectCancellation = async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.registrationId)
      .populate("eventId").populate("userId", "name email");
    if (!reg) return res.status(404).json({ msg: "Registration not found" });
    if (reg.cancellationStatus !== "requested")
      return res.status(400).json({ msg: "No pending cancellation request" });

    const reason = req.body?.reason?.trim() || "";
    reg.cancellationStatus = "rejected";
    reg.cancellationNote   = reason;
    await reg.save();

    const email = reg.userId?.email;
    const name  = reg.userId?.name || "there";
    if (email) {
      sendEmail({
        to: email,
        subject: `Cancellation Not Approved: ${reg.eventId?.title}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
  <div style="background:#dc2626;padding:20px 24px;color:#fff;"><h2 style="margin:0;">Cancellation Rejected</h2></div>
  <div style="padding:24px;"><p>Hi <strong>${name}</strong>,</p>
  <p>Your cancellation request for <strong>${reg.eventId?.title}</strong> was not approved.</p>
  ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
  <p style="color:#888;font-size:0.8rem;margin-top:24px;">Campus Event Finder</p></div></div>`,
      }).catch(() => {});
    }

    if (global.io) {
      global.io.to(reg.userId._id?.toString() || reg.userId.toString()).emit("cancellationRejected", {
        eventTitle: reg.eventId?.title,
        reason,
      });
    }

    res.json({ msg: "Cancellation rejected. Student notified." });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
};

// ── MY REGISTRATIONS ──────────────────────────────────────────────────────────
exports.myRegistrations = async (req, res) => {
  const r = await Registration.find({ userId: req.user.id }).populate("eventId");
  res.json(r);
};

// ── EVENT REGISTRATIONS (admin) ───────────────────────────────────────────────
exports.eventRegistrations = async (req, res) => {
  const r = await Registration.find({ eventId: req.params.id }).populate("userId");
  res.json(r);
};

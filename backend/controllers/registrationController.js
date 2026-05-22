const Registration = require("../models/Registration");
const Event        = require("../models/Event");
const User         = require("../models/User");
const {
  sendConfirmationEmail,
  sendAdminRegistrationAlert,
  sendWaitlistConfirmEmail,
  sendWaitlistPromotedEmail,
} = require("../services/emailService");

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
    }).save();

    // Only increment registrationCount for confirmed registrations
    if (status === "confirmed") {
      await Event.findByIdAndUpdate(req.params.eventId, { $inc: { registrationCount: 1 } });
    }

    res.json({
      msg: status === "confirmed"
        ? "Registered"
        : `Event is full. You've been added to the waitlist at position #${waitlistPosition}.`,
      status,
      waitlistPosition,
    });

    // Fire-and-forget emails
    (async () => {
      try {
        const userDoc = await User.findById(req.user.id).lean();
        const recipientEmail = (userDoc?.email || "").trim();
        const recipientName  = userDoc?.name || name || "there";
        if (!recipientEmail) return;

        if (status === "confirmed") {
          await sendConfirmationEmail(recipientEmail, event, { name: recipientName });
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
    if (e.code === 11000) return res.status(400).json({ msg: "Already registered" });
    res.status(500).send("error");
  }
};

// ── CANCEL REGISTRATION ───────────────────────────────────────────────────────
// DELETE /api/registrations/:eventId
exports.cancelRegistration = async (req, res) => {
  try {
    const reg = await Registration.findOne({
      userId:  req.user.id,
      eventId: req.params.eventId,
    });
    if (!reg) return res.status(404).json({ msg: "Registration not found" });

    const wasConfirmed = reg.status === "confirmed";
    const cancelledPosition = reg.waitlistPosition;

    await Registration.findByIdAndDelete(reg._id);

    if (wasConfirmed) {
      // Decrement confirmed count
      await Event.findByIdAndUpdate(req.params.eventId, { $inc: { registrationCount: -1 } });

      // Promote the first waitlisted person
      const next = await Registration.findOne({
        eventId:  req.params.eventId,
        status:   "waitlisted",
        waitlistPosition: 1,
      });

      if (next) {
        next.status           = "confirmed";
        next.waitlistPosition = null;
        await next.save();

        // Shift everyone else up by 1
        await Registration.updateMany(
          { eventId: req.params.eventId, status: "waitlisted" },
          { $inc: { waitlistPosition: -1 } }
        );

        // Increment confirmed count for the promoted person
        await Event.findByIdAndUpdate(req.params.eventId, { $inc: { registrationCount: 1 } });

        // Notify the promoted student
        (async () => {
          try {
            const event   = await Event.findById(req.params.eventId).lean();
            const userDoc = await User.findById(next.userId).lean();
            if (userDoc?.email && event) {
              await sendWaitlistPromotedEmail(userDoc.email, event, { name: next.name || userDoc.name || "there" });
              console.log(`[Waitlist] Promoted ${userDoc.email} for "${event.title}"`);
            }
          } catch (err) {
            console.error("[Waitlist] Promotion email failed:", err.message);
          }
        })();
      }
    } else {
      // Cancelled from waitlist — shift positions down for those behind
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

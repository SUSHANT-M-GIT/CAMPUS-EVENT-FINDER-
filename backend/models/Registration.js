const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  eventId:      { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  registeredAt: { type: Date, default: Date.now },
  name:         String,
  collegeId:    String,
  collegeName:  String,
  department:   String,
  reminderSent: { type: Boolean, default: false },

  // Waitlist: "confirmed" = registered, "waitlisted" = in queue
  status:           { type: String, enum: ["confirmed", "waitlisted"], default: "confirmed" },
  waitlistPosition: { type: Number, default: null },

  // ── Payment fields ────────────────────────────────────────────────────────
  // paymentStatus: only relevant when event.isPaid === true
  paymentStatus:     { type: String, enum: ["free", "pending", "approved", "rejected"], default: "free" },
  transactionId:     { type: String, default: "" },  // Razorpay payment ID after success
  paymentScreenshot: { type: String, default: "" },  // kept for legacy; not used in new flow
  paymentNote:       { type: String, default: "" },  // rejection reason (edge cases)

  // ── Razorpay fields ───────────────────────────────────────────────────────
  razorpayOrderId:   { type: String, default: "" },
  razorpayPaymentId: { type: String, default: "" },
  razorpaySignature: { type: String, default: "" },

  // ── QR Attendance ─────────────────────────────────────────────────────────
  attendanceQr:     { type: String, default: "" },   // base64 QR data-URL
  attendanceStatus: { type: String, enum: ["absent", "present"], default: "absent" },

  // ── Refund tracking ───────────────────────────────────────────────────────
  refundStatus:     { type: String, enum: ["none", "requested", "approved", "rejected"], default: "none" },
  refundAmount:     { type: Number, default: 0 },
  refundNote:       { type: String, default: "" },

  // ── Certificate ───────────────────────────────────────────────────────────
  certificateId:    { type: String, default: "" },   // unique cert ID assigned on generation

  // ── Cancellation request (for approved-payment registrations) ─────────────
  cancellationStatus: { type: String, enum: ["none", "requested", "approved", "rejected"], default: "none" },
  cancellationNote:   { type: String, default: "" },  // admin note on decision

  // ── Unique registration code (shown on QR + ticket) ───────────────────────
  registrationCode: { type: String, default: "" },  // e.g. "REG-ABC123"
});

schema.index({ userId: 1, eventId: 1 }, { unique: true });
schema.index({ eventId: 1, status: 1, waitlistPosition: 1 });
schema.index({ eventId: 1, paymentStatus: 1 });

module.exports = mongoose.model("Registration", schema);

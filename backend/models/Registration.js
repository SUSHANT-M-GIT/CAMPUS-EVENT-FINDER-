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
  transactionId:     { type: String, default: "" },
  paymentScreenshot: { type: String, default: "" }, // stored URL after upload
  paymentNote:       { type: String, default: "" }, // admin rejection reason

  // ── QR Attendance ─────────────────────────────────────────────────────────
  attendanceQr:     { type: String, default: "" },   // base64 QR data-URL
  attendanceStatus: { type: String, enum: ["absent", "present"], default: "absent" },

  // ── Refund tracking ───────────────────────────────────────────────────────
  refundStatus:     { type: String, enum: ["none", "requested", "approved", "rejected"], default: "none" },
  refundAmount:     { type: Number, default: 0 },
  refundNote:       { type: String, default: "" },

  // ── Certificate ───────────────────────────────────────────────────────────
  certificateId:    { type: String, default: "" },   // unique cert ID assigned on generation
});

schema.index({ userId: 1, eventId: 1 }, { unique: true });
schema.index({ eventId: 1, status: 1, waitlistPosition: 1 });
schema.index({ eventId: 1, paymentStatus: 1 });

module.exports = mongoose.model("Registration", schema);

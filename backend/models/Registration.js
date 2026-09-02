const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  registeredAt: { type: Date, default: Date.now },
  name: String,
  collegeId: String,
  collegeName: String,
  department: String,
  reminderSent: { type: Boolean, default: false },

  // Waitlist: "confirmed" = registered, "waitlisted" = in queue
  status: { type: String, enum: ['confirmed', 'waitlisted'], default: 'confirmed' },
  waitlistPosition: { type: Number, default: null },

  // ── QR Attendance ─────────────────────────────────────────────────────────
  attendanceQr: { type: String, default: '' },      // public URL to saved QR PNG file
  attendanceQrFile: { type: String, default: '' },  // server-side file path for QR image
  attendanceQrBase64: { type: String, default: '' }, // base64 PNG data URI — survives ephemeral filesystems
  attendanceStatus: { type: String, enum: ['absent', 'present'], default: 'absent' },

  // ── Certificate ───────────────────────────────────────────────────────────
  certificateId: { type: String, default: '' }, // unique cert ID assigned on generation

  // ── Cancellation request (for confirmed registrations) ─────────────
  cancellationStatus: {
    type: String,
    enum: ['none', 'requested', 'approved', 'rejected'],
    default: 'none',
  },
  cancellationNote: { type: String, default: '' }, // admin note on decision

  // ── Unique registration code (shown on QR + ticket) ───────────────────────
  registrationCode: { type: String, default: '' }, // e.g. "REG-ABC123"
});

schema.index({ userId: 1, eventId: 1 }, { unique: true });
schema.index({ eventId: 1, status: 1, waitlistPosition: 1 });

module.exports = mongoose.model('Registration', schema);

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
  status:       { type: String, enum: ["confirmed", "waitlisted"], default: "confirmed" },
  waitlistPosition: { type: Number, default: null }, // position in queue (1 = next up)
});

schema.index({ userId: 1, eventId: 1 }, { unique: true });
schema.index({ eventId: 1, status: 1, waitlistPosition: 1 }); // fast waitlist queries

module.exports = mongoose.model("Registration", schema);

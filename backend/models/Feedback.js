const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  eventId:    { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User",  required: true },
  rating:     { type: Number, min: 1, max: 5, required: true },
  comment:    { type: String, trim: true, default: "" },
  submittedAt:{ type: Date, default: Date.now },
});

// One feedback per user per event
feedbackSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("Feedback", feedbackSchema);

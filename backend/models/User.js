const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  email:       { type: String, unique: true, lowercase: true, trim: true },
  password:    String,

  // role: "student" (default) or "admin"
  role:        { type: String, enum: ["admin","student"], default: "student" },

  collegeName: { type: String, default: "", trim: true },
  collegeId:   { type: String, default: "", trim: true },
  department:  { type: String, default: "", trim: true },

  // Email verification (OTP)
  isVerified:  { type: Boolean, default: false },
  otp:         { type: String,  default: null },
  otpExpiry:   { type: Date,    default: null },

  // Admin verification workflow fields
  clubName:           { type: String, default: "", trim: true },
  designation:        { type: String, default: "", trim: true },
  officialEmail:      { type: String, default: "", trim: true },
  instagramHandle:    { type: String, default: "", trim: true },
  verificationStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, lowercase: true, trim: true },
    password: String,

    // role: "student" (default), "professional", or "admin"
    role: { type: String, enum: ['admin', 'student', 'professional'], default: 'student' },
    accountStatus: {
      type: String,
      enum: ['active', 'flagged', 'suspended', 'deactivated'],
      default: 'active',
    },

    collegeName: { type: String, default: '', trim: true },
    collegeId: { type: String, default: '', trim: true },
    department: { type: String, default: '', trim: true },
    // Professional-specific fields
    company: { type: String, default: '', trim: true },

    // Email verification (OTP)
    isVerified: { type: Boolean, default: false },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    passwordResetToken: { type: String, default: null },
    passwordResetExpiry: { type: Date, default: null },
    ownerLoginOtp: { type: String, default: null },
    ownerLoginOtpExpiry: { type: Date, default: null },

    // Contact / Phone
    phone: { type: String, default: '', trim: true },

    // Admin verification & 1-click email approval workflow fields
    clubName: { type: String, default: '', trim: true },
    designation: { type: String, default: '', trim: true },
    officialEmail: { type: String, default: '', trim: true },
    instagramHandle: { type: String, default: '', trim: true },
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    organizerApprovalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    organizerApprovalTokenHash: { type: String, default: null },
    organizerApprovalTokenExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

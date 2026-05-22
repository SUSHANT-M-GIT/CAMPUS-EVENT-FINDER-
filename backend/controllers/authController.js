const User   = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { sendEmail } = require("../services/emailService");

// ── Email validation helpers ──────────────────────────────────────────────────

const FORMAT_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const COLLEGE_SUFFIXES = [".edu", ".ac.in", ".edu.in", ".ac.uk", ".edu.au"];

/** Returns true only for institutional/college email domains */
function isValidCollegeEmail(email) {
  if (!FORMAT_RE.test(email)) return false;
  const domain = email.split("@")[1].toLowerCase();
  return COLLEGE_SUFFIXES.some(s => domain.endsWith(s));
}

// ── OTP helpers ───────────────────────────────────────────────────────────────

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpEmail(email, otp, name) {
  await sendEmail({
    to: email,
    subject: "🔐 Verify your Campus Event Finder account",
    html: `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
  <div style="background:#023047;padding:20px 24px;color:#fff;">
    <h2 style="margin:0;font-size:1.2rem;">Email Verification</h2>
  </div>
  <div style="padding:24px;">
    <p>Hi <strong>${name}</strong>,</p>
    <p>Use the OTP below to verify your account. It expires in <strong>10 minutes</strong>.</p>
    <div style="text-align:center;margin:24px 0;">
      <span style="font-size:2.2rem;font-weight:700;letter-spacing:10px;color:#023047;">${otp}</span>
    </div>
    <p style="color:#888;font-size:0.85rem;">If you didn't create this account, ignore this email.</p>
    <p style="color:#888;font-size:0.75rem;margin-top:24px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, collegeName } = req.body;

    if (!email)                 return res.status(400).json({ msg: "Email is required" });
    if (!FORMAT_RE.test(email)) return res.status(400).json({ msg: "Invalid email format" });

    // College email required for students only.
    // Admins/organizers can use Gmail, Yahoo, or any valid email.
    const isAdmin = role === "admin";
    if (!isAdmin && !isValidCollegeEmail(email))
      return res.status(400).json({
        msg: "Students must use a college email (ending in .edu, .ac.in, .edu.in, .ac.uk, or .edu.au)",
      });

    if (!collegeName?.trim()) return res.status(400).json({ msg: "College / organisation name is required" });

    let u = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
    if (u && u.isVerified) return res.status(400).json({ msg: "User already exists" });

    const otp       = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const hash      = await bcrypt.hash(password, 10);

    if (u) {
      // Unverified account — refresh with new data
      u.name = name; u.password = hash;
      u.role = isAdmin ? "admin" : "user";
      u.collegeName = collegeName.trim();
      u.otp = otp; u.otpExpiry = otpExpiry;
      await u.save();
    } else {
      u = await new User({
        name, email, password: hash,
        role: isAdmin ? "admin" : "user",
        collegeName: collegeName.trim(),
        isVerified: false, otp, otpExpiry,
      }).save();
    }

    sendOtpEmail(email, otp, name).catch(err =>
      console.error("[OTP] Failed to send:", err.message)
    );

    res.json({ msg: "OTP sent to your email. Please verify to complete registration.", email });
  } catch (e) {
    console.error("Register Error:", e);
    res.status(500).json({ msg: e.message || "error" });
  }
};

// ── VERIFY EMAIL ──────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ msg: "Email and OTP are required" });

    const u = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
    if (!u)           return res.status(400).json({ msg: "Account not found" });
    if (u.isVerified) return res.status(400).json({ msg: "Account already verified" });
    if (!u.otp || u.otp !== otp) return res.status(400).json({ msg: "Invalid OTP" });
    if (u.otpExpiry < new Date()) return res.status(400).json({ msg: "OTP has expired. Please request a new one." });

    u.isVerified = true; u.otp = null; u.otpExpiry = null;
    await u.save();

    res.json({ msg: "Email verified successfully! You can now log in." });
  } catch (e) {
    console.error("Verify Error:", e);
    res.status(500).json({ msg: e.message || "error" });
  }
};

// ── RESEND OTP ────────────────────────────────────────────────────────────────
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email is required" });

    const u = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
    if (!u)           return res.status(400).json({ msg: "Account not found" });
    if (u.isVerified) return res.status(400).json({ msg: "Account already verified" });

    const otp = generateOtp();
    u.otp = otp; u.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await u.save();

    sendOtpEmail(email, otp, u.name).catch(err =>
      console.error("[OTP] Resend failed:", err.message)
    );

    res.json({ msg: "New OTP sent to your email." });
  } catch (e) {
    res.status(500).json({ msg: e.message || "error" });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email)                 return res.status(400).json({ msg: "Email is required" });
    if (!FORMAT_RE.test(email)) return res.status(400).json({ msg: "Invalid email format" });

    const u = await User.findOne({ email: new RegExp(`^${email}$`, "i") });
    if (!u) return res.status(400).json({ msg: "Invalid Credentials" });

    if (!u.isVerified)
      return res.status(403).json({ msg: "Please verify your email before logging in.", email, needsVerification: true });

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(400).json({ msg: "Invalid Credentials" });

    const token = jwt.sign(
      { user: { id: u.id, role: u.role, collegeName: u.collegeName || "" } },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.json({ token });
  } catch (e) {
    console.error("Login Error:", e);
    res.status(500).json({ msg: e.message || "error" });
  }
};

// ── REQUEST ADMIN ACCESS ──────────────────────────────────────────────────────
exports.requestAdmin = async (req, res) => {
  try {
    const { clubName, designation, officialEmail, instagramHandle } = req.body;

    if (!clubName?.trim())    return res.status(400).json({ msg: "Club name is required" });
    if (!designation?.trim()) return res.status(400).json({ msg: "Designation is required" });
    if (!officialEmail?.trim() || !FORMAT_RE.test(officialEmail))
      return res.status(400).json({ msg: "Valid official email is required" });

    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ msg: "User not found" });

    if (u.role === "admin")
      return res.status(400).json({ msg: "You are already an admin" });
    if (u.verificationStatus === "pending" && u.clubName)
      return res.status(400).json({ msg: "Admin request already submitted. Awaiting approval." });

    u.clubName        = clubName.trim();
    u.designation     = designation.trim();
    u.officialEmail   = officialEmail.trim();
    u.instagramHandle = instagramHandle?.trim() || "";
    u.verificationStatus = "pending";
    await u.save();

    res.json({ msg: "Admin access request submitted. You will be notified once reviewed." });
  } catch (e) {
    console.error("requestAdmin Error:", e);
    res.status(500).json({ msg: e.message || "error" });
  }
};

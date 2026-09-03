const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const {
  sendEmail,
  sendOrganizerApprovalRequestEmail,
  sendOrganizerApprovedNotificationEmail,
  sendOrganizerRejectedNotificationEmail,
} = require('../services/emailService');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Email validation helpers ──────────────────────────────────────────────────

const FORMAT_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ── OTP helpers ───────────────────────────────────────────────────────────────

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOtpEmail(email, otp, name) {
  console.log(`[OTP] Sending OTP to: ${email}`);
  console.log(`[OTP] Generated OTP: ${otp}`);

  const sent = await sendEmail({
    to: email,
    subject: '🔐 Verify your Campus Event Finder account',
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

  if (sent) {
    console.log(`✅ [OTP] Email sent successfully to: ${email}`);
  } else {
    console.error(`❌ [OTP] Email failed to send to: ${email}`);
  }

  return sent; // returns true/false
}

function generateResetToken() {
  return crypto.randomBytes(28).toString('hex');
}

async function sendPasswordResetEmail(email, token, name) {
  // Priority: FRONTEND_URL (set on Render dashboard) → APP_URL → known production URL → localhost dev
  // IMPORTANT: Set FRONTEND_URL=https://c-e-s.vercel.app on Render to make this work in production.
  // APP_URL on Render must NOT be localhost — it should be the frontend domain.
  let frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || '';
  // If frontendUrl is localhost (local .env leaked to production), override with CLIENT_URL or warn
  if (!frontendUrl || frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1')) {
    if (process.env.CLIENT_URL) frontendUrl = process.env.CLIENT_URL;
    else {
      console.warn('[PasswordReset] WARNING: FRONTEND_URL not set or still localhost — reset link will be broken in production. Set FRONTEND_URL on Render.');
      frontendUrl = 'http://localhost:5173'; // dev only
    }
  }
  frontendUrl = frontendUrl.replace(/\/$/, '');
  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  console.log(`[PasswordReset] Reset link frontend domain: ${frontendUrl} (token omitted)`);

  return await sendEmail({
    to: email,
    subject: '🔐 Reset your Campus Event Finder password',
    // Instruct Brevo NOT to rewrite/track links in this security-critical email
    headers: { 'X-Mailin-Track-Click': 'no' },
    html: `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden;">
  <div style="background:#023047;padding:20px 24px;color:#fff;">
    <h2 style="margin:0;font-size:1.2rem;">Password Reset Request</h2>
  </div>
  <div style="padding:24px;">
    <p>Hi <strong>${name}</strong>,</p>
    <p>We received a request to reset your Campus Event Finder password. Click the button below to choose a new password. This link expires in <strong>60 minutes</strong>.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${resetLink}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;">Reset password</a>
    </div>
    <p style="font-size:0.8rem;color:#666;word-break:break-all;">If the button does not work, copy and paste this link into your browser:<br/><span style="color:#4f46e5;">${resetLink}</span></p>
    <p style="color:#888;font-size:0.9rem;">If you did not request a password reset, you can safely ignore this email.</p>
    <p style="color:#888;font-size:0.75rem;margin-top:24px;">Campus Event Finder</p>
  </div>
</div>`,
    text: `Password Reset Request\n\nHi ${name},\n\nWe received a request to reset your Campus Event Finder password.\n\nCopy and paste this link into your browser to reset your password:\n${resetLink}\n\nThis link expires in 60 minutes.\n\nIf you did not request a password reset, you can safely ignore this email.\n\nCampus Event Finder`,
  });
}

// ── 1-Click Organizer Approval Helper ─────────────────────────────────────────

async function createAndSendOrganizerApprovalRequest(u, req) {
  try {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    u.organizerApprovalTokenHash = tokenHash;
    u.organizerApprovalTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    u.verificationStatus = 'pending';
    u.organizerApprovalStatus = 'pending';
    await u.save();

    const baseUrl = (
      process.env.FRONTEND_URL ||
      process.env.APP_URL ||
      (req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:5173')
    ).replace(/\/$/, '');
    const approveUrl = `${baseUrl}/organizer-approval/approve/${rawToken}`;
    const rejectUrl = `${baseUrl}/organizer-approval/reject/${rawToken}`;
    const ownerEmail = process.env.PLATFORM_OWNER_EMAIL || process.env.EMAIL_USER;

    if (ownerEmail) {
      await sendOrganizerApprovalRequestEmail({
        ownerEmail,
        organizer: u,
        approveUrl,
        rejectUrl,
      });
      console.log(`[Approval] Sent 1-click organizer approval request to platform owner (${ownerEmail}) for: ${u.email}`);
    } else {
      console.warn('[Approval] PLATFORM_OWNER_EMAIL / EMAIL_USER not configured. Skipping approval email.');
    }
  } catch (err) {
    console.error('[Approval] Failed to send organizer approval email:', err.message);
  }
}

function renderApprovalHtml({ title, heading, message, type }) {
  const icon = type === 'success' ? '✅' : type === 'warn' ? '⚠️' : '❌';
  const color = type === 'success' ? '#10b981' : type === 'warn' ? '#f59e0b' : '#ef4444';
  const appUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Campus Event Finder</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 12px 36px rgba(0,0,0,0.4); }
    .icon { font-size: 3rem; margin-bottom: 16px; }
    h1 { margin: 0 0 12px; font-size: 1.5rem; color: #f8fafc; }
    p { margin: 0 0 24px; color: #94a3b8; font-size: 1rem; line-height: 1.6; }
    .btn { display: inline-block; background: ${color}; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${heading}</h1>
    <p>${message}</p>
    <a href="${appUrl}" class="btn">Return to Campus Event Finder</a>
  </div>
</body>
</html>
  `;
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, collegeName, collegeId, company, designation, phone } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!email) return res.status(400).json({ msg: 'Email is required' });
    if (!FORMAT_RE.test(email)) return res.status(400).json({ msg: 'Invalid email format' });

    if (role && !['student', 'professional', 'admin'].includes(role)) {
      return res.status(400).json({ msg: 'Invalid account role.' });
    }

    // Validate required fields per role
    if (role === 'student') {
      if (!collegeName?.trim())
        return res.status(400).json({ msg: 'College / university name is required for students' });
      if (!collegeId?.trim())
        return res.status(400).json({ msg: 'College ID / roll number is required for students' });
    } else if (role === 'professional') {
      // company is optional, but we still need a designation
    } else if (role === 'admin') {
      if (!collegeName?.trim())
        return res.status(400).json({ msg: 'College / organisation name is required' });
      if (!phone?.trim())
        return res.status(400).json({ msg: 'Phone number is required for Admin / Organizer accounts' });
    } else {
      // default student check
      if (!collegeName?.trim())
        return res.status(400).json({ msg: 'College / university name is required' });
    }

    if (!collegeName?.trim() && role !== 'professional')
      return res.status(400).json({ msg: 'College / organisation name is required' });

    const isAdmin = role === 'admin';
    const isProfessional = role === 'professional';
    let u = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (u && u.isVerified) return res.status(400).json({ msg: 'User already exists' });

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    const hash = await bcrypt.hash(password, 10);

    if (u) {
      u.name = name;
      u.password = hash;
      u.role = isAdmin ? 'admin' : isProfessional ? 'professional' : 'student';
      u.collegeName = collegeName?.trim() || '';
      if (collegeId) u.collegeId = collegeId.trim();
      if (company) u.company = company.trim();
      if (designation) u.designation = designation.trim();
      if (phone) u.phone = phone.trim();
      if (isAdmin) {
        u.clubName = collegeName?.trim() || u.clubName || '';
        u.verificationStatus = 'pending';
        u.organizerApprovalStatus = 'pending';
      }
      u.otp = otp;
      u.otpExpiry = otpExpiry;
      await u.save();
    } else {
      u = await new User({
        name,
        email,
        password: hash,
        role: isAdmin ? 'admin' : isProfessional ? 'professional' : 'student',
        collegeName: collegeName?.trim() || '',
        collegeId: collegeId?.trim() || '',
        company: company?.trim() || '',
        designation: designation?.trim() || '',
        phone: phone?.trim() || '',
        clubName: isAdmin ? collegeName?.trim() || '' : '',
        verificationStatus: 'pending',
        organizerApprovalStatus: 'pending',
        accountStatus: 'active',
        isVerified: false,
        otp,
        otpExpiry,
      }).save();
    }

    console.log(`[Register] Sending OTP to: ${email}`);
    console.log(`[Register] Generated OTP: ${otp}`);

    const emailSent = await sendOtpEmail(email, otp, name);

    if (!emailSent) {
      console.error(`[Register] OTP email failed for: ${email}`);
      return res.status(500).json({
        success: false,
        msg: 'Failed to send OTP email. Please check your email address and try again.',
      });
    }

    console.log(`[Register] OTP email sent successfully to: ${email}`);
    res.json({
      success: true,
      msg: 'OTP sent to your email. Please verify to complete registration.',
      email,
    });
  } catch (e) {
    console.error('Register Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};

// ── VERIFY EMAIL ──────────────────────────────────────────────────────────────
exports.verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ msg: 'Email and OTP are required' });

    const u = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (!u) return res.status(400).json({ msg: 'Account not found' });
    if (u.isVerified) return res.status(400).json({ msg: 'Account already verified' });
    if (!u.otp || u.otp !== otp) return res.status(400).json({ msg: 'Invalid OTP' });
    if (u.otpExpiry < new Date())
      return res.status(400).json({ msg: 'OTP has expired. Please request a new one.' });

    u.isVerified = true;
    u.otp = null;
    u.otpExpiry = null;
    await u.save();

    if (u.role === 'admin') {
      await createAndSendOrganizerApprovalRequest(u, req);
      return res.json({
        msg: 'Email verified successfully! Your organizer account has been created and is waiting for approval by the platform owner.',
        pendingApproval: true,
      });
    }

    res.json({ msg: 'Email verified successfully! You can now log in.' });
  } catch (e) {
    console.error('Verify Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};

// ── RESEND OTP ────────────────────────────────────────────────────────────────
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email is required' });

    const u = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (!u) return res.status(400).json({ msg: 'Account not found' });
    if (u.isVerified) return res.status(400).json({ msg: 'Account already verified' });

    const otp = generateOtp();
    u.otp = otp;
    u.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await u.save();

    console.log(`[ResendOTP] Resending OTP to: ${email}`);
    console.log(`[ResendOTP] Generated OTP: ${otp}`);

    const emailSent = await sendOtpEmail(email, otp, u.name);

    if (!emailSent) {
      console.error(`[ResendOTP] OTP email failed for: ${email}`);
      return res.status(500).json({
        success: false,
        msg: 'Failed to send OTP email. Please check your email address and try again.',
      });
    }

    console.log(`[ResendOTP] OTP email sent successfully to: ${email}`);
    res.json({ success: true, msg: 'New OTP sent to your email.' });
  } catch (e) {
    res.status(500).json({ msg: e.message || 'error' });
  }
};

// ── FORGOT PASSWORD ────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email is required' });

    const u = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (!u || !u.isVerified) {
      return res.json({
        success: true,
        msg: 'If that account exists, a reset link has been emailed.',
      });
    }

    const resetToken = generateResetToken();
    u.passwordResetToken = resetToken;
    u.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await u.save();

    // Send email — fire non-blocking so the DB token is never rolled back on email failure
    sendPasswordResetEmail(u.email, resetToken, u.name).then((sent) => {
      if (!sent) console.error(`[PasswordReset] Email delivery failed for ${u.email} — token saved, user can retry`);
    }).catch((err) => {
      console.error('[PasswordReset] Email error:', err.message);
    });

    res.json({ success: true, msg: 'If that account exists, a reset link has been emailed.' });
  } catch (e) {
    console.error('ForgotPassword Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};

// ── RESET PASSWORD ─────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, token, password } = req.body;
    if (!email || !token || !password)
      return res.status(400).json({ msg: 'Email, token, and password are required' });

    const u = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (!u || !u.passwordResetToken || u.passwordResetToken !== token)
      return res.status(400).json({ msg: 'Invalid or expired reset token' });
    if (!u.passwordResetExpiry || u.passwordResetExpiry < new Date())
      return res.status(400).json({ msg: 'Reset token has expired. Please request a new one.' });

    const hash = await bcrypt.hash(password, 10);
    u.password = hash;
    u.passwordResetToken = null;
    u.passwordResetExpiry = null;
    await u.save();

    res.json({
      success: true,
      msg: 'Password has been reset. You can now log in with your new password.',
    });
  } catch (e) {
    console.error('ResetPassword Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email is required' });
    if (!FORMAT_RE.test(email)) return res.status(400).json({ msg: 'Invalid email format' });

    const u = await User.findOne({ email: new RegExp(`^${email}$`, 'i') });
    if (!u) return res.status(400).json({ msg: 'Invalid Credentials' });

    if (!u.isVerified)
      return res.status(403).json({
        msg: 'Please verify your email before logging in.',
        email,
        needsVerification: true,
      });

    if (u.accountStatus === 'suspended' || u.accountStatus === 'deactivated') {
      return res.status(403).json({ msg: `Account is ${u.accountStatus}. Contact support.` });
    }

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(400).json({ msg: 'Invalid Credentials' });

    if (u.role === 'admin' && (u.verificationStatus !== 'approved' || u.organizerApprovalStatus === 'rejected')) {
      const msg = (u.verificationStatus === 'rejected' || u.organizerApprovalStatus === 'rejected')
        ? 'Your organizer request was not approved.'
        : 'Your organizer account is waiting for approval.';
      return res.status(403).json({ msg });
    }

    const token = jwt.sign(
      {
        user: {
          id: u.id,
          role: u.role,
          collegeName: u.collegeName || '',
          company: u.company || '',
          designation: u.designation || '',
        },
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.json({ token });
  } catch (e) {
    console.error('Login Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};

// ── REQUEST ADMIN ACCESS ──────────────────────────────────────────────────────
exports.requestAdmin = async (req, res) => {
  try {
    const { clubName, designation, officialEmail, instagramHandle, phone } = req.body;

    if (!clubName?.trim()) return res.status(400).json({ msg: 'Club name is required' });
    if (!designation?.trim()) return res.status(400).json({ msg: 'Designation is required' });
    if (!officialEmail?.trim() || !FORMAT_RE.test(officialEmail))
      return res.status(400).json({ msg: 'Valid official email is required' });

    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ msg: 'User not found' });

    if (u.role === 'admin') return res.status(400).json({ msg: 'You are already an admin' });
    if (u.verificationStatus === 'pending' && u.clubName)
      return res.status(400).json({ msg: 'Admin request already submitted. Awaiting approval.' });

    u.clubName = clubName.trim();
    u.designation = designation.trim();
    u.officialEmail = officialEmail.trim();
    if (phone) u.phone = phone.trim();
    u.instagramHandle = instagramHandle?.trim() || '';
    u.verificationStatus = 'pending';
    u.organizerApprovalStatus = 'pending';
    await u.save();

    await createAndSendOrganizerApprovalRequest(u, req);

    res.json({ msg: 'Admin access request submitted. You will be notified once reviewed.' });
  } catch (e) {
    console.error('requestAdmin Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};

// ── GOOGLE OAUTH ──────────────────────────────────────────────────────────────
// POST /api/auth/google
// Body: { idToken, role, collegeName, collegeId, company, designation, phone }
exports.googleAuth = async (req, res) => {
  try {
    const { idToken, role, collegeName, collegeId, company, designation, phone } = req.body;
    if (!idToken) return res.status(400).json({ msg: 'Google token is required' });

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId || googleClientId === 'your_google_client_id_here.apps.googleusercontent.com') {
      console.error('[Google OAuth] Server GOOGLE_CLIENT_ID is missing or unconfigured.');
      return res.status(500).json({
        msg: 'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID in the environment variables.',
      });
    }

    let googleEmail = '';
    let googleName = 'User';

    // Try ID token verification first (credential flow)
    // If that fails, try access token via userinfo endpoint
    try {
      const client = new OAuth2Client(googleClientId);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
      const payload = ticket.getPayload();
      googleEmail = (payload.email || '').toLowerCase().trim();
      googleName = payload.name || 'User';
      console.log('[Google OAuth] Verified via ID token:', googleEmail);
    } catch {
      console.log('[Google OAuth] ID token verification failed, trying access token userinfo...');
      try {
        const infoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!infoRes.ok) throw new Error(`userinfo returned ${infoRes.status}`);
        const info = await infoRes.json();
        googleEmail = (info.email || '').toLowerCase().trim();
        googleName = info.name || info.given_name || 'User';
        console.log('[Google OAuth] Verified via access token:', googleEmail);
      } catch (err2) {
        console.error('[Google OAuth] Both token methods failed:', err2.message);
        return res.status(401).json({ msg: 'Invalid or expired Google token. Please try signing in again.' });
      }
    }

    if (!googleEmail)
      return res.status(400).json({ msg: 'Could not retrieve email from Google account' });

    // Check if user already exists (Account Linking)
    let u = await User.findOne({ email: new RegExp(`^${googleEmail}$`, 'i') });

    if (u) {
      if (u.accountStatus === 'suspended' || u.accountStatus === 'deactivated') {
        return res.status(403).json({ msg: `Account is ${u.accountStatus}. Contact support.` });
      }

      if (u.role === 'admin' && (u.verificationStatus !== 'approved' || u.organizerApprovalStatus === 'rejected')) {
        const msg = (u.verificationStatus === 'rejected' || u.organizerApprovalStatus === 'rejected')
          ? 'Your organizer request was not approved.'
          : 'Your organizer account is waiting for approval.';
        return res.status(403).json({ msg });
      }

      if (!u.isVerified) {
        u.isVerified = true;
        await u.save();
      }

      const token = jwt.sign(
        {
          user: {
            id: u.id,
            role: u.role,
            collegeName: u.collegeName || '',
            company: u.company || '',
            designation: u.designation || '',
          },
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      return res.json({ token, isNewUser: false });
    }

    // New user — Profile completion check
    if (!role || !['student', 'professional', 'admin'].includes(role)) {
      return res.status(200).json({
        needsProfileCompletion: true,
        isNewUser: true,
        googleEmail,
        googleName,
        provider: 'google',
        msg: 'Please complete your profile to finish registration.',
      });
    }

    // Validate required profile information per selected role
    if (role === 'student') {
      if (!collegeName?.trim() || !collegeId?.trim()) {
        return res.status(200).json({
          needsProfileCompletion: true,
          isNewUser: true,
          googleEmail,
          googleName,
          role: 'student',
          provider: 'google',
          msg: 'Please provide both College Name and College ID.',
        });
      }
    } else if (role === 'professional') {
      if (!designation?.trim()) {
        return res.status(200).json({
          needsProfileCompletion: true,
          isNewUser: true,
          googleEmail,
          googleName,
          role: 'professional',
          provider: 'google',
          msg: 'Please provide your Designation / Role.',
        });
      }
    } else if (role === 'admin') {
      if (!collegeName?.trim()) {
        return res.status(200).json({
          needsProfileCompletion: true,
          isNewUser: true,
          googleEmail,
          googleName,
          role: 'admin',
          provider: 'google',
          msg: 'Please provide your College or Organization Name.',
        });
      }
      if (!phone?.trim()) {
        return res.status(200).json({
          needsProfileCompletion: true,
          isNewUser: true,
          googleEmail,
          googleName,
          role: 'admin',
          provider: 'google',
          msg: 'Please provide your Phone / Contact Number.',
        });
      }
    }

    const isAdmin = role === 'admin';
    const isProfessional = role === 'professional';

    // Create new account — Google-verified
    u = await new User({
      name: googleName,
      email: googleEmail,
      password: '',
      role: isAdmin ? 'admin' : isProfessional ? 'professional' : 'student',
      collegeName: collegeName?.trim() || '',
      collegeId: role === 'student' ? collegeId.trim() : '',
      company: isProfessional ? (company?.trim() || '') : '',
      designation: isProfessional ? designation.trim() : (isAdmin ? (designation?.trim() || 'Event Organizer') : ''),
      phone: phone?.trim() || '',
      clubName: isAdmin ? collegeName.trim() : '',
      verificationStatus: isAdmin ? 'pending' : 'approved',
      organizerApprovalStatus: isAdmin ? 'pending' : 'approved',
      accountStatus: 'active',
      isVerified: true,
    }).save();

    if (isAdmin) {
      await createAndSendOrganizerApprovalRequest(u, req);
      return res.json({
        isNewUser: true,
        pendingApproval: true,
        msg: 'Your organizer account has been created and is waiting for approval by the platform owner.',
      });
    }

    const token = jwt.sign(
      {
        user: {
          id: u.id,
          role: u.role,
          collegeName: u.collegeName || '',
          company: u.company || '',
          designation: u.designation || '',
        },
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, isNewUser: true });
  } catch (e) {
    console.error('googleAuth Error:', e);
    res.status(500).json({ msg: e.message || 'Google sign-in failed' });
  }
};

// ── MICROSOFT OAUTH ───────────────────────────────────────────────────────────
// POST /api/auth/microsoft
// Body: { accessToken, idToken, role, collegeName, collegeId, company, designation, phone }
exports.microsoftAuth = async (req, res) => {
  try {
    const { accessToken, idToken, role, collegeName, collegeId, company, designation, phone } = req.body;
    if (!accessToken && !idToken) {
      return res.status(400).json({ msg: 'Microsoft authentication token is required.' });
    }

    let msEmail = '';
    let msName = 'User';

    // Verify token with Microsoft Graph /me
    if (accessToken) {
      try {
        const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (graphRes.ok) {
          const data = await graphRes.json();
          msEmail = (data.mail || data.userPrincipalName || '').toLowerCase().trim();
          msName = data.displayName || 'User';
          console.log('[Microsoft OAuth] Verified via Graph API:', msEmail);
        }
      } catch (err) {
        console.error('[Microsoft OAuth] Graph API error:', err.message);
      }
    }

    // Fallback: parse ID token if Graph API failed or returned no email
    if (!msEmail && idToken) {
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          msEmail = (payload.email || payload.preferred_username || payload.upn || '').toLowerCase().trim();
          msName = payload.name || 'User';
          console.log('[Microsoft OAuth] Extracted from ID token:', msEmail);
        }
      } catch (tokenErr) {
        console.error('[Microsoft OAuth] ID token parse error:', tokenErr.message);
      }
    }

    if (!msEmail) {
      return res.status(401).json({ msg: 'Invalid or expired Microsoft token. Please try signing in again.' });
    }

    // Check if user already exists (Account Linking)
    let u = await User.findOne({ email: new RegExp(`^${msEmail}$`, 'i') });

    if (u) {
      if (u.accountStatus === 'suspended' || u.accountStatus === 'deactivated') {
        return res.status(403).json({ msg: `Account is ${u.accountStatus}. Contact support.` });
      }

      if (u.role === 'admin' && (u.verificationStatus !== 'approved' || u.organizerApprovalStatus === 'rejected')) {
        const msg = (u.verificationStatus === 'rejected' || u.organizerApprovalStatus === 'rejected')
          ? 'Your organizer request was not approved.'
          : 'Your organizer account is waiting for approval.';
        return res.status(403).json({ msg });
      }

      if (!u.isVerified) {
        u.isVerified = true;
        await u.save();
      }

      const token = jwt.sign(
        {
          user: {
            id: u.id,
            role: u.role,
            collegeName: u.collegeName || '',
            company: u.company || '',
            designation: u.designation || '',
          },
        },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      return res.json({ token, isNewUser: false });
    }

    // New user — Profile completion check
    if (!role || !['student', 'professional', 'admin'].includes(role)) {
      return res.status(200).json({
        needsProfileCompletion: true,
        isNewUser: true,
        msEmail,
        msName,
        provider: 'microsoft',
        msg: 'Please complete your profile to finish registration.',
      });
    }

    // Validate required profile fields for new users
    if (role === 'student') {
      if (!collegeName?.trim() || !collegeId?.trim()) {
        return res.status(200).json({
          needsProfileCompletion: true,
          isNewUser: true,
          msEmail,
          msName,
          role: 'student',
          provider: 'microsoft',
          msg: 'Please provide both College Name and College ID.',
        });
      }
    } else if (role === 'professional') {
      if (!designation?.trim()) {
        return res.status(200).json({
          needsProfileCompletion: true,
          isNewUser: true,
          msEmail,
          msName,
          role: 'professional',
          provider: 'microsoft',
          msg: 'Please provide your Designation / Role.',
        });
      }
    } else if (role === 'admin') {
      if (!collegeName?.trim()) {
        return res.status(200).json({
          needsProfileCompletion: true,
          isNewUser: true,
          msEmail,
          msName,
          role: 'admin',
          provider: 'microsoft',
          msg: 'Please provide your College or Organization Name.',
        });
      }
      if (!phone?.trim()) {
        return res.status(200).json({
          needsProfileCompletion: true,
          isNewUser: true,
          msEmail,
          msName,
          role: 'admin',
          provider: 'microsoft',
          msg: 'Please provide your Phone / Contact Number.',
        });
      }
    }

    const isAdmin = role === 'admin';
    const isProfessional = role === 'professional';

    // Create new account — Microsoft verified
    u = await new User({
      name: msName,
      email: msEmail,
      password: '',
      role: isAdmin ? 'admin' : isProfessional ? 'professional' : 'student',
      collegeName: collegeName?.trim() || '',
      collegeId: role === 'student' ? collegeId.trim() : '',
      company: isProfessional ? (company?.trim() || '') : '',
      designation: isProfessional ? designation.trim() : (isAdmin ? (designation?.trim() || 'Event Organizer') : ''),
      phone: phone?.trim() || '',
      clubName: isAdmin ? collegeName.trim() : '',
      verificationStatus: isAdmin ? 'pending' : 'approved',
      organizerApprovalStatus: isAdmin ? 'pending' : 'approved',
      accountStatus: 'active',
      isVerified: true,
    }).save();

    if (isAdmin) {
      await createAndSendOrganizerApprovalRequest(u, req);
      return res.json({
        isNewUser: true,
        pendingApproval: true,
        msg: 'Your organizer account has been created and is waiting for approval by the platform owner.',
      });
    }

    const token = jwt.sign(
      {
        user: {
          id: u.id,
          role: u.role,
          collegeName: u.collegeName || '',
          company: u.company || '',
          designation: u.designation || '',
        },
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, isNewUser: true });
  } catch (e) {
    console.error('microsoftAuth Error:', e);
    res.status(500).json({ msg: e.message || 'Microsoft sign-in failed' });
  }
};

// ── 1-CLICK ORGANIZER APPROVAL ENDPOINTS ──────────────────────────────────────
exports.handleOrganizerApproval = async (req, res) => {
  const wantsJson = Boolean(
    req?.headers?.accept?.includes('application/json') ||
    req?.query?.format === 'json' ||
    req?.xhr
  );

  try {
    const { token } = req.params || {};
    if (!token) {
      if (wantsJson) return res.status(400).json({ success: false, msg: 'The approval link is missing or corrupted.' });
      return res.status(400).send(renderApprovalHtml({
        title: 'Invalid Link',
        heading: 'Invalid Approval Link',
        message: 'The approval link is missing or corrupted.',
        type: 'error',
      }));
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const u = await User.findOne({ organizerApprovalTokenHash: tokenHash });

    if (!u) {
      if (wantsJson) return res.status(400).json({ success: false, msg: 'This approval link has already been used or does not exist.' });
      return res.status(400).send(renderApprovalHtml({
        title: 'Link Used or Invalid',
        heading: 'Link Already Used or Invalid',
        message: 'This approval link has already been used or does not exist.',
        type: 'warn',
      }));
    }

    if (u.organizerApprovalTokenExpiry && u.organizerApprovalTokenExpiry < new Date()) {
      if (wantsJson) return res.status(400).json({ success: false, msg: 'This 24-hour approval link has expired. The organizer should submit a new request.' });
      return res.status(400).send(renderApprovalHtml({
        title: 'Link Expired',
        heading: 'Approval Link Expired',
        message: 'This 24-hour approval link has expired. The organizer should submit a new request.',
        type: 'warn',
      }));
    }

    if (u.verificationStatus === 'approved' && u.organizerApprovalStatus === 'approved') {
      if (wantsJson) return res.json({ success: true, msg: `${u.name} (${u.clubName || u.collegeName || 'Club'}) is already an approved Event Organizer.` });
      return res.send(renderApprovalHtml({
        title: 'Already Approved',
        heading: 'Organizer Already Approved',
        message: `${u.name} (${u.clubName || u.collegeName || 'Club'}) is already an approved Event Organizer.`,
        type: 'success',
      }));
    }

    u.verificationStatus = 'approved';
    u.organizerApprovalStatus = 'approved';
    u.organizerApprovalTokenHash = null;
    u.organizerApprovalTokenExpiry = null;
    await u.save();

    await sendOrganizerApprovedNotificationEmail(u);

    if (wantsJson) {
      return res.json({
        success: true,
        msg: `${u.name} from ${u.clubName || u.collegeName || 'their institution'} has been successfully approved as an Event Organizer. A notification email has been sent to them.`,
      });
    }

    return res.send(renderApprovalHtml({
      title: 'Organizer Approved',
      heading: '✅ Organizer Approved!',
      message: `<strong>${u.name}</strong> from <strong>${u.clubName || u.collegeName || 'their institution'}</strong> has been successfully approved as an Event Organizer. A notification email has been sent to them.`,
      type: 'success',
    }));
  } catch (err) {
    console.error('handleOrganizerApproval Error:', err);
    if (wantsJson) return res.status(500).json({ success: false, msg: 'A server error occurred while processing the approval.' });
    return res.status(500).send(renderApprovalHtml({
      title: 'Server Error',
      heading: 'Approval Failed',
      message: 'A server error occurred while processing the approval.',
      type: 'error',
    }));
  }
};

exports.handleOrganizerRejection = async (req, res) => {
  const wantsJson = Boolean(
    req?.headers?.accept?.includes('application/json') ||
    req?.query?.format === 'json' ||
    req?.xhr
  );

  try {
    const { token } = req.params || {};
    if (!token) {
      if (wantsJson) return res.status(400).json({ success: false, msg: 'The rejection link is missing or corrupted.' });
      return res.status(400).send(renderApprovalHtml({
        title: 'Invalid Link',
        heading: 'Invalid Link',
        message: 'The rejection link is missing or corrupted.',
        type: 'error',
      }));
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const u = await User.findOne({ organizerApprovalTokenHash: tokenHash });

    if (!u) {
      if (wantsJson) return res.status(400).json({ success: false, msg: 'This link has already been used or does not exist.' });
      return res.status(400).send(renderApprovalHtml({
        title: 'Link Used or Invalid',
        heading: 'Link Already Used or Invalid',
        message: 'This link has already been used or does not exist.',
        type: 'warn',
      }));
    }

    if (u.organizerApprovalTokenExpiry && u.organizerApprovalTokenExpiry < new Date()) {
      if (wantsJson) return res.status(400).json({ success: false, msg: 'This link has expired.' });
      return res.status(400).send(renderApprovalHtml({
        title: 'Link Expired',
        heading: 'Link Expired',
        message: 'This link has expired.',
        type: 'warn',
      }));
    }

    u.verificationStatus = 'rejected';
    u.organizerApprovalStatus = 'rejected';
    u.organizerApprovalTokenHash = null;
    u.organizerApprovalTokenExpiry = null;
    await u.save();

    await sendOrganizerRejectedNotificationEmail(u);

    if (wantsJson) {
      return res.json({
        success: true,
        msg: `The request for ${u.name} has been rejected. A notification update has been sent to them.`,
      });
    }

    return res.send(renderApprovalHtml({
      title: 'Organizer Request Rejected',
      heading: '❌ Organizer Request Rejected',
      message: `The request for <strong>${u.name}</strong> has been rejected. A notification update has been sent to them.`,
      type: 'error',
    }));
  } catch (err) {
    console.error('handleOrganizerRejection Error:', err);
    if (wantsJson) return res.status(500).json({ success: false, msg: 'A server error occurred while processing the request.' });
    return res.status(500).send(renderApprovalHtml({
      title: 'Server Error',
      heading: 'Rejection Failed',
      message: 'A server error occurred while processing the request.',
      type: 'error',
    }));
  }
};

// ── GET CURRENT USER PROFILE ──────────────────────────────────────────────────
// Requires authentication
// Returns full user profile data (excluding sensitive fields)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'Current password and new password are required.' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ msg: 'New password must be at least 6 characters long.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found.' });

    const isMatch = await bcrypt.compare(String(currentPassword), user.password || '');
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect.' });
    }

    if (String(currentPassword) === String(newPassword)) {
      return res.status(400).json({ msg: 'New password must be different from the current password.' });
    }

    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();

    res.json({ success: true, msg: 'Password updated successfully.' });
  } catch (error) {
    console.error('changePassword Error:', error);
    res.status(500).json({ msg: error.message || 'Unable to update password.' });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) return res.status(400).json({ msg: 'User ID is required' });

    const u = await User.findById(userId).select(
      '-password -otp -otpExpiry -passwordResetToken -passwordResetExpiry -organizerApprovalTokenHash -organizerApprovalTokenExpiry'
    );
    if (!u) return res.status(404).json({ msg: 'User not found' });

    res.json({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      collegeName: u.collegeName || '',
      collegeId: u.collegeId || '',
      department: u.department || '',
      company: u.company || '',
      designation: u.designation || '',
      phone: u.phone || '',
      isVerified: u.isVerified,
      clubName: u.clubName || '',
      officialEmail: u.officialEmail || '',
      instagramHandle: u.instagramHandle || '',
      verificationStatus: u.verificationStatus,
      organizerApprovalStatus: u.organizerApprovalStatus || u.verificationStatus,
      accountStatus: u.accountStatus,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    });
  } catch (e) {
    console.error('getCurrentUser Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};


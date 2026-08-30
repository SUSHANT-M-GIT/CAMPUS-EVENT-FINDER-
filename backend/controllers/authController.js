const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { sendEmail } = require('../services/emailService');

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
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const resetLink = `${appUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(
    email
  )}`;

  return await sendEmail({
    to: email,
    subject: '🔐 Reset your Campus Event Finder password',
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
    <p style="color:#888;font-size:0.9rem;">If you did not request a password reset, you can safely ignore this email.</p>
    <p style="color:#888;font-size:0.75rem;margin-top:24px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, collegeName, collegeId, company, designation } = req.body;
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
      // company is optional, but we still need a name
    } else if (role !== 'admin') {
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
      if (isAdmin) {
        u.clubName = collegeName?.trim() || u.clubName || '';
        u.verificationStatus = 'pending';
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
        clubName: isAdmin ? collegeName?.trim() || '' : '',
        verificationStatus: 'pending',
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

    const emailSent = await sendPasswordResetEmail(u.email, resetToken, u.name);
    if (!emailSent) {
      return res
        .status(500)
        .json({ msg: 'Failed to send password reset email. Please try again later.' });
    }

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

    if (u.role === 'admin' && u.verificationStatus !== 'approved') {
      return res.status(403).json({
        msg: `Admin Verification: ${u.verificationStatus === 'rejected' ? 'Rejected' : 'Pending'}. Await admin approval.`,
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
    res.json({ token });
  } catch (e) {
    console.error('Login Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};

// ── REQUEST ADMIN ACCESS ──────────────────────────────────────────────────────
exports.requestAdmin = async (req, res) => {
  try {
    const { clubName, designation, officialEmail, instagramHandle } = req.body;

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
    u.instagramHandle = instagramHandle?.trim() || '';
    u.verificationStatus = 'pending';
    await u.save();

    res.json({ msg: 'Admin access request submitted. You will be notified once reviewed.' });
  } catch (e) {
    console.error('requestAdmin Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};

// ── GOOGLE OAUTH ──────────────────────────────────────────────────────────────
// POST /api/auth/google
// Body: { idToken, role, collegeName, collegeId, company, designation }
// idToken may be a Google ID token OR an access token from useGoogleLogin
exports.googleAuth = async (req, res) => {
  try {
    const { idToken, role, collegeName, collegeId, company, designation } = req.body;
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
    // If that fails, try access token via userinfo endpoint (implicit/auth-code flow)
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
      // Fall back to access token — fetch user info from Google
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
      // Existing user — verify account status
      if (u.accountStatus === 'suspended' || u.accountStatus === 'deactivated') {
        return res.status(403).json({ msg: `Account is ${u.accountStatus}. Contact support.` });
      }

      if (u.role === 'admin' && u.verificationStatus !== 'approved') {
        return res.status(403).json({
          msg: `Admin Verification: ${u.verificationStatus === 'rejected' ? 'Rejected' : 'Pending'}. Await admin approval.`,
        });
      }

      // Existing user — auto-verify email if not verified yet
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
      clubName: isAdmin ? collegeName.trim() : '',
      verificationStatus: 'approved',
      accountStatus: 'active',
      isVerified: true,
    }).save();

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
// Body: { accessToken, idToken, role, collegeName, collegeId, company, designation }
exports.microsoftAuth = async (req, res) => {
  try {
    const { accessToken, idToken, role, collegeName, collegeId, company, designation } = req.body;
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
      // Existing user — verify account status
      if (u.accountStatus === 'suspended' || u.accountStatus === 'deactivated') {
        return res.status(403).json({ msg: `Account is ${u.accountStatus}. Contact support.` });
      }

      if (u.role === 'admin' && u.verificationStatus !== 'approved') {
        return res.status(403).json({
          msg: `Admin Verification: ${u.verificationStatus === 'rejected' ? 'Rejected' : 'Pending'}. Await admin approval.`,
        });
      }

      // Existing user — auto-verify email if not verified yet
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
      clubName: isAdmin ? collegeName.trim() : '',
      verificationStatus: 'approved',
      accountStatus: 'active',
      isVerified: true,
    }).save();

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
      '-password -otp -otpExpiry -passwordResetToken -passwordResetExpiry'
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
      isVerified: u.isVerified,
      clubName: u.clubName || '',
      officialEmail: u.officialEmail || '',
      instagramHandle: u.instagramHandle || '',
      verificationStatus: u.verificationStatus,
      accountStatus: u.accountStatus,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    });
  } catch (e) {
    console.error('getCurrentUser Error:', e);
    res.status(500).json({ msg: e.message || 'error' });
  }
};

/**
 * emailService.js
 * Primary: Gmail SMTP via Nodemailer (requires App Password)
 * Fallback: Brevo SMTP (300 free emails/day)
 * All env vars read at call-time (never at module load).
 */
const nodemailer = require("nodemailer");

function getTransport() {
  // Primary: Gmail SMTP (if configured)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log("🔧 Using Gmail SMTP transport");
    // Google App Passwords are sometimes stored with spaces (e.g. "abcd efgh ijkl mnop")
    // Nodemailer requires no spaces — strip them here
    const cleanPass = process.env.EMAIL_PASS.replace(/\s+/g, "");
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: cleanPass,
      },
    });
  }
  
  // Fallback: Brevo SMTP
  if (process.env.BREVO_USER && process.env.BREVO_PASS) {
    console.log("🔧 Using Brevo SMTP transport (fallback)");
    return nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_USER,
        pass: process.env.BREVO_PASS,
      },
    });
  }

  throw new Error("No email transport configured. Set EMAIL_USER/EMAIL_PASS or BREVO_USER/BREVO_PASS");
}

function getFrom() {
  // Use EMAIL_USER for Gmail, otherwise EMAIL_FROM or default
  if (process.env.EMAIL_USER) {
    return `Campus Event Finder <${process.env.EMAIL_USER}>`;
  }
  return process.env.EMAIL_FROM || "Campus Event Finder <noreply@campuseventfinder.com>";
}

function formatDate(d) {
  if (!d) return "TBD";
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ─── core send (returns true on success, false on failure) ────────────────────

async function sendEmail({ to, subject, html }) {
  // ── diagnostic logs (safe to keep in production) ──
  console.log("📧 Attempting to send email to:", to);
  console.log("📧 Subject:", subject);

  try {
    // Check if email transport is configured
    const gmailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
    const brevoConfigured = !!(process.env.BREVO_USER && process.env.BREVO_PASS);

    if (!gmailConfigured && !brevoConfigured) {
      console.error(`❌ [Email] SKIP — No email service configured (to="${to}")`);
      console.error("⚠️  Set EMAIL_USER/EMAIL_PASS for Gmail OR BREVO_USER/BREVO_PASS for Brevo");
      return false;
    }

    if (gmailConfigured) {
      console.log("✅ Gmail credentials detected:");
      console.log("   EMAIL_USER:", process.env.EMAIL_USER);
      const cleanPass = process.env.EMAIL_PASS.replace(/\s+/g, "");
      console.log("   EMAIL_PASS (cleaned):", cleanPass ? cleanPass.slice(0, 4) + "..." : "NOT SET");
      console.log("   Password length (no spaces):", cleanPass.length);
    } else if (brevoConfigured) {
      console.log("✅ Brevo credentials detected (fallback):");
      console.log("   BREVO_USER:", process.env.BREVO_USER);
      console.log("   BREVO_PASS:", process.env.BREVO_PASS ? process.env.BREVO_PASS.slice(0, 10) + "..." : "NOT SET");
    }

    const from = getFrom();
    console.log(`📤 [Email] Sending from="${from}" to="${to}"`);
    
    const transporter = getTransport();
    const info = await transporter.sendMail({ from, to, subject, html });
    
    console.log(`✅ [Email] SUCCESS → Email delivered to="${to}" | messageId="${info.messageId}"`);
    return true;
  } catch (err) {
    console.error(`❌ [Email] FAILED → to="${to}"`);
    console.error(`❌ Error details: ${err.message}`);
    
    // Provide helpful troubleshooting info
    if (err.message.includes("Invalid login") || err.message.includes("Username and Password not accepted")) {
      console.error("⚠️  Gmail Authentication Failed:");
      console.error("   1. Make sure you're using Gmail App Password (NOT regular password)");
      console.error("   2. Enable 2-Step Verification in Google Account");
      console.error("   3. Generate App Password: https://myaccount.google.com/apppasswords");
      console.error("   4. Use the 16-character app password in .env EMAIL_PASS");
    }
    
    return false;
  }
}

// ─── named helpers used by controllers and scheduler ─────────────────────────

async function sendConfirmationEmail(to, event, registration) {
  const qrSection = registration.attendanceQr
    ? `<div style="text-align:center;margin:24px 0;padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
        <p style="margin:0 0 12px;font-weight:700;color:#1e293b;font-size:1rem;">📱 Your Attendance QR Code</p>
        <img src="${registration.attendanceQr}" alt="Attendance QR" style="width:180px;height:180px;border-radius:8px;border:1px solid #e2e8f0;" />
        <p style="margin:12px 0 4px;font-size:0.85rem;color:#64748b;">Show this QR at the venue for attendance.</p>
        <div style="display:inline-block;background:#4f46e5;color:#fff;padding:8px 20px;border-radius:99px;font-family:monospace;font-size:1.1rem;font-weight:800;letter-spacing:0.1em;margin-top:8px;">
          ${registration.registrationCode || ""}
        </div>
        <p style="margin:6px 0 0;font-size:0.78rem;color:#94a3b8;">Use this code for manual attendance if QR scan fails.</p>
      </div>`
    : `<div style="text-align:center;margin:20px 0;padding:14px;background:#f1f5f9;border-radius:8px;">
        <p style="margin:0 0 6px;font-size:0.85rem;color:#64748b;">Your Registration Code</p>
        <div style="display:inline-block;background:#4f46e5;color:#fff;padding:8px 20px;border-radius:99px;font-family:monospace;font-size:1.1rem;font-weight:800;letter-spacing:0.1em;">
          ${registration.registrationCode || ""}
        </div>
        <p style="margin:6px 0 0;font-size:0.78rem;color:#94a3b8;">Provide this code to the admin for manual attendance.</p>
      </div>`;

  await sendEmail({
    to,
    subject: `✅ Registration Confirmed: ${event.title}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#4f46e5;padding:24px;color:#fff;"><h2 style="margin:0;">Registration Confirmed!</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${registration.name || "there"}</strong>,</p>
    <p>You have successfully registered for the following event:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${event.time || "TBD"}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || "TBD"}</td></tr>
      ${event.description ? `<tr><td style="padding:8px;font-weight:bold;">Description</td><td style="padding:8px;">${event.description}</td></tr>` : ""}
    </table>
    ${qrSection}
    <p>You will receive a reminder email before the event starts.</p>
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

async function sendReminderEmail(to, event, registration) {
  await sendEmail({
    to,
    subject: `⏰ Reminder: "${event.title}" is tomorrow!`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#f59e0b;padding:24px;color:#fff;"><h2 style="margin:0;">Event Reminder — 24 Hours to go!</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${registration.name || "there"}</strong>,</p>
    <p>Your event starts in approximately <strong>24 hours</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${event.time || "TBD"}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || "TBD"}</td></tr>
    </table>
    <p>See you there!</p>
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

async function sendNewEventAnnouncement(emails, event, appUrl) {
  if (!emails || emails.length === 0) {
    console.log("[Email] Announcement: no recipients.");
    return;
  }
  const eventLink = appUrl ? `${appUrl}/events/${event._id}` : null;
  const subject   = `🎉 New Event: ${event.title}`;
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#10b981;padding:24px;color:#fff;"><h2 style="margin:0;">New Event Posted!</h2></div>
  <div style="padding:24px;">
    <p>A new event has been posted on <strong>Campus Event Finder</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${event.time || "TBD"}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || "TBD"}</td></tr>
      ${event.description ? `<tr><td style="padding:8px;font-weight:bold;">Description</td><td style="padding:8px;">${event.description}</td></tr>` : ""}
    </table>
    ${eventLink ? `<p><a href="${eventLink}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Event &amp; Register</a></p>` : ""}
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`;

  console.log(`[Email] Announcement: ${emails.length} recipient(s): ${emails.join(", ")}`);
  for (const email of emails) {
    await sendEmail({ to: email, subject, html });
  }
}

async function sendAdminRegistrationAlert(adminEmail, event, student) {
  await sendEmail({
    to: adminEmail,
    subject: `🎉 New Registration: ${event.title}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#023047;padding:20px 24px;color:#fff;"><h2 style="margin:0;">New Participant Registered!</h2></div>
  <div style="padding:24px;">
    <p>A new student has registered for your event <strong>${event.title}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Student</td><td style="padding:8px;">${student.name || "N/A"}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${student.email || "N/A"}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">College</td><td style="padding:8px;">${student.collegeName || "N/A"}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Department</td><td style="padding:8px;">${student.department || "N/A"}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">College ID</td><td style="padding:8px;">${student.collegeId || "N/A"}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Total Registered</td><td style="padding:8px;">${event.registrationCount} / ${event.maxRegistrations}</td></tr>
    </table>
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder — Admin Notification</p>
  </div>
</div>`,
  });
}

async function sendFeedbackRequestEmail(to, event, appUrl) {
  const feedbackLink = appUrl ? `${appUrl}/feedback/${event._id}` : null;
  await sendEmail({
    to,
    subject: `⭐ How was "${event.title}"? Share your feedback`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#FFB703;padding:24px;color:#023047;"><h2 style="margin:0;">How was the event?</h2></div>
  <div style="padding:24px;">
    <p>Hi there,</p>
    <p>We hope you enjoyed <strong>${event.title}</strong>! Your feedback helps organisers improve future events.</p>
    <p>It only takes 30 seconds — just a star rating and an optional comment.</p>
    ${feedbackLink
      ? `<p style="text-align:center;margin:28px 0;">
           <a href="${feedbackLink}" style="background:#023047;color:#FFB703;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;">
             ⭐ Leave Feedback
           </a>
         </p>`
      : ""}
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

async function sendWaitlistConfirmEmail(to, event, registration) {
  await sendEmail({
    to,
    subject: `⏳ You're on the waitlist: ${event.title}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#8b5cf6;padding:24px;color:#fff;"><h2 style="margin:0;">You're on the Waitlist!</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${registration.name || "there"}</strong>,</p>
    <p>The event <strong>${event.title}</strong> is currently full, but you've been added to the waitlist at position <strong>#${registration.waitlistPosition}</strong>.</p>
    <p>If a spot opens up, you'll be automatically moved to confirmed and notified immediately.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || "TBD"}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Your Position</td><td style="padding:8px;">#${registration.waitlistPosition}</td></tr>
    </table>
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

async function sendWaitlistPromotedEmail(to, event, registration) {
  await sendEmail({
    to,
    subject: `🎉 Spot available! You're now registered: ${event.title}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#10b981;padding:24px;color:#fff;"><h2 style="margin:0;">You're In! 🎉</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${registration.name || "there"}</strong>,</p>
    <p>Great news! A spot opened up and you've been <strong>automatically confirmed</strong> for:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${event.time || "TBD"}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || "TBD"}</td></tr>
    </table>
    <p>You will receive a reminder email before the event starts.</p>
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

async function sendEventCancellationEmail(to, event, reason) {
  await sendEmail({
    to,
    subject: `❌ Event Cancelled: ${event.title}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#dc2626;padding:24px;color:#fff;"><h2 style="margin:0;">Event Cancelled</h2></div>
  <div style="padding:24px;">
    <p>We're sorry to inform you that the following event has been <strong>cancelled</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || "TBD"}</td></tr>
      ${reason ? `<tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Reason</td><td style="padding:8px;">${reason}</td></tr>` : ""}
    </table>
    <p>We apologise for any inconvenience caused. Keep an eye out for future events on Campus Event Finder.</p>
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

module.exports = { sendEmail, sendConfirmationEmail, sendReminderEmail, sendNewEventAnnouncement, sendAdminRegistrationAlert, sendFeedbackRequestEmail, sendWaitlistConfirmEmail, sendWaitlistPromotedEmail, sendEventCancellationEmail };

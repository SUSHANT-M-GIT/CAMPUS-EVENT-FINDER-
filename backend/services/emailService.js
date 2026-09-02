/**
 * emailService.js
 * High-Reliability Email Delivery Engine:
 * 1. Resend HTTPS API (Port 443 — Unblocked on Render, Railway, AWS, Vercel)
 * 2. Brevo HTTPS API (Port 443 — Unblocked on all cloud providers)
 * 3. Gmail SMTP (Port 465 SSL / Port 587 STARTTLS with IPv4 enforcement)
 * 4. Brevo SMTP Relay (Port 587 / 2525)
 */
const nodemailer = require('nodemailer');

// ─── 1. HTTPS REST API Transports (Port 443 - 100% unblocked on Render) ────────

async function sendViaResend({ to, subject, html, attachments = [] }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  console.log('🚀 [Email] Sending via Resend HTTPS API (Port 443)...');
  const from = process.env.RESEND_FROM || 'Campus Event Finder <onboarding@resend.dev>';
  const reply_to = process.env.EMAIL_USER || undefined;

  const formattedAttachments = attachments.map((att) => ({
    filename: att.filename || 'attachment.png',
    content: Buffer.isBuffer(att.content)
      ? att.content.toString('base64')
      : Buffer.from(att.content || '').toString('base64'),
  }));

  const payload = {
    from,
    to: [to],
    subject,
    html,
    ...(reply_to ? { reply_to } : {}),
    ...(formattedAttachments.length > 0 ? { attachments: formattedAttachments } : {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');

    // 403 means domain not verified or sending restricted — log clearly, fall through to next provider
    if (res.status === 403) {
      console.warn(`⚠️ [Email] Resend failed: 403`);
      console.warn(`⚠️ [Email] Reason: sender/domain not verified or testing restrictions apply`);
      console.warn(`⚠️ [Email] Falling back to Brevo`);
      throw new Error(`Resend API HTTP 403: ${errText}`);
    }

    throw new Error(`Resend API HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json().catch(() => ({}));
  console.log(`✅ [Email] SUCCESS → Delivered to="${to}" via Resend HTTPS API | id="${data.id || 'OK'}"`);
  return true;
}

async function sendViaBrevoApi({ to, subject, html, text, headers: customHeaders = {}, attachments = [] }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return false;

  const startTime = Date.now();
  console.log(`🚀 [Email] Sending via Brevo HTTPS API (Port 443)...`);
  const senderEmail = process.env.EMAIL_USER || process.env.BREVO_SENDER || 'noreply@campuseventfinder.com';

  const formattedAttachments = attachments.map((att) => ({
    name: att.filename || 'attachment.png',
    content: Buffer.isBuffer(att.content)
      ? att.content.toString('base64')
      : Buffer.from(att.content || '').toString('base64'),
  }));

  const payload = {
    sender: { name: 'Campus Event Finder', email: senderEmail },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
    // Pass custom headers (e.g. X-Mailin-Track-Click: no for security emails)
    ...(Object.keys(customHeaders).length > 0 ? { headers: customHeaders } : {}),
    ...(formattedAttachments.length > 0 ? { attachment: formattedAttachments } : {}),
  };

  const brevoController = new AbortController();
  const brevoTimeoutId = setTimeout(() => brevoController.abort(), 10000); // 10s timeout

  let res;
  try {
    res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: brevoController.signal,
    });
  } finally {
    clearTimeout(brevoTimeoutId);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Brevo API HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json().catch(() => ({}));
  const durationMs = Date.now() - startTime;
  console.log(`✅ [Email] SUCCESS → Accepted by Brevo | to="${to}" | messageId="${data.messageId || 'OK'}" | duration=${durationMs}ms`);
  return true;
}

// ─── 2. Direct SMTP Transports (For local development or hosts with open SMTP) ─

function createGmailTransport(port = 465, secure = true) {
  const cleanPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: cleanPass,
    },
    family: 4, // Forces IPv4 to avoid ENETUNREACH IPv6 errors
    connectionTimeout: 8000,
    greetingTimeout: 6000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

function createBrevoTransport(port = 587) {
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port,
    secure: false,
    auth: {
      user: process.env.BREVO_USER,
      pass: process.env.BREVO_PASS,
    },
    family: 4,
    connectionTimeout: 8000,
    greetingTimeout: 6000,
    socketTimeout: 10000,
  });
}

function getFrom() {
  if (process.env.EMAIL_USER) {
    return `Campus Event Finder <${process.env.EMAIL_USER}>`;
  }
  return process.env.EMAIL_FROM || 'Campus Event Finder <noreply@campuseventfinder.com>';
}

function formatDate(d) {
  if (!d) return 'TBD';
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Core send (Returns true on success, false on failure) ───────────────────

async function sendEmail({ to, subject, html, text, headers: customHeaders = {}, attachments = [] }) {
  const reqTime = new Date().toISOString();
  console.log(`📧 [Email] requestedAt=${reqTime} to="${to}" subject="${subject}"`);

  // Strategy 1: Resend HTTPS API (Port 443)
  // Skip Resend entirely if EMAIL_PROVIDER=brevo is set (avoids guaranteed 403 when domain unverified)
  const emailProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (process.env.RESEND_API_KEY && emailProvider !== 'brevo') {
    try {
      const ok = await sendViaResend({ to, subject, html, attachments });
      if (ok) return true;
    } catch (errResend) {
      console.warn(`⚠️ [Email] Resend HTTPS API failed: ${errResend.message}`);
    }
  }

  // Strategy 2: Brevo HTTPS API (Port 443)
  if (process.env.BREVO_API_KEY) {
    try {
      const ok = await sendViaBrevoApi({ to, subject, html, text, headers: customHeaders, attachments });
      if (ok) return true;
    } catch (errBrevoApi) {
      console.warn(`⚠️ [Email] Brevo HTTPS API failed: ${errBrevoApi.message}`);
    }
  }

  // Strategy 3: Gmail SMTP (Port 465 SSL, IPv4)
  const gmailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  const from = getFrom();

  if (gmailConfigured) {
    try {
      console.log('🔧 [Email] Trying Gmail SMTP Port 465 (Direct SSL, IPv4)...');
      const transporter = createGmailTransport(465, true);
      const info = await transporter.sendMail({ from, to, subject, html, text, attachments });
      console.log(`✅ [Email] SUCCESS → Email delivered to="${to}" via Gmail (Port 465) | messageId="${info.messageId}"`);
      return true;
    } catch (err465) {
      console.warn(`⚠️ [Email] Gmail Port 465 failed: ${err465.message}. Retrying via Port 587...`);

      // Strategy 4: Gmail SMTP (Port 587 STARTTLS, IPv4)
      try {
        const transporter587 = createGmailTransport(587, false);
        const info587 = await transporter587.sendMail({ from, to, subject, html, attachments });
        console.log(`✅ [Email] SUCCESS → Email delivered to="${to}" via Gmail (Port 587) | messageId="${info587.messageId}"`);
        return true;
      } catch (err587) {
        console.error(`❌ [Email] Gmail Port 587 failed: ${err587.message}`);
      }
    }
  }

  // Strategy 5: Brevo SMTP Relay (Port 587 / 2525)
  if (process.env.BREVO_USER && process.env.BREVO_PASS) {
    try {
      console.log('🔧 [Email] Trying Brevo SMTP fallback (Port 587, IPv4)...');
      const brevoTransporter = createBrevoTransport(587);
      const infoBrevo = await brevoTransporter.sendMail({ from, to, subject, html, attachments });
      console.log(`✅ [Email] SUCCESS → Email delivered to="${to}" via Brevo SMTP | messageId="${infoBrevo.messageId}"`);
      return true;
    } catch (errBrevo) {
      console.error(`❌ [Email] Brevo SMTP failed: ${errBrevo.message}`);
    }
  }

  console.error(`❌ [Email] FAILED → All email delivery strategies failed for: "${to}"`);
  return false;
}

// ─── named helpers used by controllers and scheduler ─────────────────────────

function buildQrUrl(registration) {
  // Use BACKEND_URL for QR file serving — APP_URL/FRONTEND_URL is the frontend
  let backendUrl = 'http://localhost:5000';
  if (process.env.BACKEND_URL) backendUrl = process.env.BACKEND_URL.replace(/\/$/, '');
  else if (process.env.RAILWAY_PUBLIC_DOMAIN) backendUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  else if (process.env.RENDER_EXTERNAL_URL) backendUrl = process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');

  const qrCandidate = registration.attendanceQr || registration.attendanceQrFile || '';

  if (!qrCandidate) return '';
  if (qrCandidate.startsWith('http://') || qrCandidate.startsWith('https://')) return qrCandidate;

  const normalizedPath = qrCandidate.startsWith('/') ? qrCandidate : `/${qrCandidate}`;
  return `${backendUrl}${normalizedPath}`;
}

async function buildQrAttachment(registration) {
  const qrCandidate = registration.attendanceQr || registration.attendanceQrFile || '';
  if (!qrCandidate) return null;

  const fs = require('fs');
  const path = require('path');

  let filePath = '';
  if (qrCandidate.startsWith('http://') || qrCandidate.startsWith('https://')) {
    try {
      const url = new URL(qrCandidate);
      filePath = path.resolve(__dirname, '..', url.pathname.replace(/^\/+/, ''));
    } catch {
      return null;
    }
  } else {
    filePath = path.resolve(__dirname, '..', qrCandidate.replace(/^\/+/, ''));
  }

  if (!fs.existsSync(filePath)) return null;

  return {
    filename: 'attendance-qr.png',
    content: fs.readFileSync(filePath),
    contentType: 'image/png',
    cid: 'attendance-qr',
  };
}

async function sendConfirmationEmail(to, event, registration, backendBaseUrl) {
  console.log(`[Email] sendConfirmationEmail: to=${to}, code=${registration.registrationCode}`);

  const regCode = registration.registrationCode || '';
  const registrationId = registration._id?.toString() || registration.id?.toString() || '';

  // Determine backend URL — parameter from controller (built from req) takes priority over env vars
  let resolvedBackendUrl = '';
  if (backendBaseUrl) resolvedBackendUrl = backendBaseUrl.replace(/\/$/, '');
  else if (process.env.BACKEND_URL) resolvedBackendUrl = process.env.BACKEND_URL.replace(/\/$/, '');
  else if (process.env.RAILWAY_PUBLIC_DOMAIN) resolvedBackendUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  else if (process.env.RENDER_EXTERNAL_URL) resolvedBackendUrl = process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');

  const qrImageUrl = (registrationId && resolvedBackendUrl)
    ? `${resolvedBackendUrl}/api/attendance/qr-image/${registrationId}`
    : '';

  const hasQr = !!qrImageUrl;
  console.log(`[Email] QR image URL: ${hasQr ? qrImageUrl : 'none — set BACKEND_URL on Render'}`);

  const qrSection = `
    <div style="text-align:center;margin:24px 0;padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
      <p style="margin:0 0 12px;font-weight:700;color:#1e293b;font-size:1rem;">Your Attendance QR Code</p>
      ${hasQr
        ? `<img src="${qrImageUrl}" alt="Attendance QR Code" width="200" height="200" style="width:200px;height:200px;border-radius:8px;border:2px solid #e2e8f0;display:block;margin:0 auto;" />`
        : '<p style="color:#94a3b8;font-size:0.85rem;">QR code will be available shortly.</p>'}
      <p style="margin:12px 0 4px;font-size:0.85rem;color:#64748b;">Show this QR at the venue for attendance.</p>
      <div style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 24px;border-radius:99px;font-family:monospace;font-size:1.2rem;font-weight:800;letter-spacing:0.12em;margin-top:10px;">
        ${regCode}
      </div>
      <p style="margin:8px 0 0;font-size:0.78rem;color:#94a3b8;">Use this code for manual attendance if QR scan fails.</p>
    </div>`;

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#4f46e5;padding:24px;color:#fff;"><h2 style="margin:0;">Registration Confirmed!</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${registration.name || 'there'}</strong>,</p>
    <p>You have successfully registered for the following event:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${event.time || 'TBD'}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || 'TBD'}</td></tr>
      ${event.description ? `<tr><td style="padding:8px;font-weight:bold;">Description</td><td style="padding:8px;">${event.description}</td></tr>` : ''}
    </table>
    ${qrSection}
    <p>You will receive a reminder email before the event starts.</p>
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`;

  await sendEmail({ to, subject: `Registration Confirmed: ${event.title}`, html, attachments: [] });
  console.log(`[Email] Confirmation email queued — hasQr=${hasQr}`);
}

async function sendReminderEmail(to, event, registration) {
  await sendEmail({
    to,
    subject: `⏰ Reminder: "${event.title}" is tomorrow!`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#f59e0b;padding:24px;color:#fff;"><h2 style="margin:0;">Event Reminder — 24 Hours to go!</h2></div>
  <div style="padding:24px;">
    <p>Hi <strong>${registration.name || 'there'}</strong>,</p>
    <p>Your event starts in approximately <strong>24 hours</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${event.time || 'TBD'}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || 'TBD'}</td></tr>
    </table>
    <p>See you there!</p>
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

async function sendNewEventAnnouncement(emails, event, appUrl) {
  if (!emails || emails.length === 0) {
    console.log('[Email] Announcement: no recipients.');
    return;
  }
  const eventLink = appUrl ? `${appUrl}/events/${event._id}` : null;
  const subject = `🎉 New Event: ${event.title}`;
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
  <div style="background:#10b981;padding:24px;color:#fff;"><h2 style="margin:0;">New Event Posted!</h2></div>
  <div style="padding:24px;">
    <p>A new event has been posted on <strong>Campus Event Finder</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${event.time || 'TBD'}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || 'TBD'}</td></tr>
      ${event.description ? `<tr><td style="padding:8px;font-weight:bold;">Description</td><td style="padding:8px;">${event.description}</td></tr>` : ''}
    </table>
    ${eventLink ? `<p><a href="${eventLink}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">View Event &amp; Register</a></p>` : ''}
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`;

  console.log(`[Email] Announcement: ${emails.length} recipient(s): ${emails.join(', ')}`);
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
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Student</td><td style="padding:8px;">${student.name || 'N/A'}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Email</td><td style="padding:8px;">${student.email || 'N/A'}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">College</td><td style="padding:8px;">${student.collegeName || 'N/A'}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Department</td><td style="padding:8px;">${student.department || 'N/A'}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">College ID</td><td style="padding:8px;">${student.collegeId || 'N/A'}</td></tr>
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
    ${
      feedbackLink
        ? `<p style="text-align:center;margin:28px 0;">
           <a href="${feedbackLink}" style="background:#023047;color:#FFB703;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:1rem;">
             ⭐ Leave Feedback
           </a>
         </p>`
        : ''
    }
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
    <p>Hi <strong>${registration.name || 'there'}</strong>,</p>
    <p>The event <strong>${event.title}</strong> is currently full, but you've been added to the waitlist at position <strong>#${registration.waitlistPosition}</strong>.</p>
    <p>If a spot opens up, you'll be automatically moved to confirmed and notified immediately.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || 'TBD'}</td></tr>
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
    <p>Hi <strong>${registration.name || 'there'}</strong>,</p>
    <p>Great news! A spot opened up and you've been <strong>automatically confirmed</strong> for:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;font-weight:bold;width:140px;">Event</td><td style="padding:8px;">${event.title}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${formatDate(event.date)}</td></tr>
      <tr><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${event.time || 'TBD'}</td></tr>
      <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || 'TBD'}</td></tr>
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
      <tr><td style="padding:8px;font-weight:bold;">Venue</td><td style="padding:8px;">${event.location || 'TBD'}</td></tr>
      ${reason ? `<tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:bold;">Reason</td><td style="padding:8px;">${reason}</td></tr>` : ''}
    </table>
    <p>We apologise for any inconvenience caused. Keep an eye out for future events on Campus Event Finder.</p>
    <p style="color:#888;font-size:12px;margin-top:32px;">Campus Event Finder</p>
  </div>
</div>`,
  });
}

async function sendOrganizerApprovalRequestEmail({
  ownerEmail,
  organizer,
  approveUrl,
  rejectUrl,
}) {
  const subject = `🔔 New Organizer Request: ${organizer.name} - ${organizer.clubName || organizer.collegeName || 'Campus Club'}`;
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#023047,#1e3a5f);padding:24px;color:#ffffff;text-align:center;">
    <h2 style="margin:0;font-size:1.4rem;">New Organizer Request</h2>
    <p style="margin:6px 0 0;font-size:0.9rem;opacity:0.85;">Campus Event Finder &amp; Manager</p>
  </div>
  <div style="padding:28px 24px;">
    <p style="font-size:1rem;color:#1e293b;margin:0 0 16px;">
      A new user has registered as an <strong>Admin / Organizer</strong> and is requesting access to publish and manage campus events.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:24px;">
      <h3 style="margin:0 0 12px;font-size:1rem;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Applicant Details</h3>
      <table style="width:100%;border-collapse:collapse;font-size:0.92rem;">
        <tr>
          <td style="padding:6px 0;color:#64748b;width:140px;font-weight:600;">Full Name:</td>
          <td style="padding:6px 0;color:#0f172a;font-weight:700;">${organizer.name}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-weight:600;">Email:</td>
          <td style="padding:6px 0;color:#0f172a;"><a href="mailto:${organizer.email}" style="color:#4f46e5;text-decoration:none;">${organizer.email}</a></td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-weight:600;">Phone Number:</td>
          <td style="padding:6px 0;color:#0f172a;font-weight:600;">${organizer.phone || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-weight:600;">Institution / College:</td>
          <td style="padding:6px 0;color:#0f172a;">${organizer.collegeName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-weight:600;">Club / Organization:</td>
          <td style="padding:6px 0;color:#0f172a;font-weight:600;">${organizer.clubName || organizer.collegeName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;font-weight:600;">Designation / Role:</td>
          <td style="padding:6px 0;color:#0f172a;">${organizer.designation || 'Event Organizer'}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:0.9rem;color:#475569;margin-bottom:20px;text-align:center;">
      Click one of the secure 1-click buttons below to approve or reject this organizer:
    </p>

    <!-- 1-Click Action Buttons -->
    <table style="width:100%;margin:20px 0;">
      <tr>
        <td style="text-align:center;padding:8px;">
          <a href="${approveUrl}" style="background:#10b981;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;display:inline-block;box-shadow:0 4px 12px rgba(16,185,129,0.3);">
            ✅ APPROVE ORGANIZER
          </a>
        </td>
        <td style="text-align:center;padding:8px;">
          <a href="${rejectUrl}" style="background:#ef4444;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;display:inline-block;box-shadow:0 4px 12px rgba(239,68,68,0.3);">
            ❌ REJECT
          </a>
        </td>
      </tr>
    </table>

    <p style="font-size:0.78rem;color:#94a3b8;margin-top:24px;text-align:center;">
      This is a secure, single-use link that expires in 24 hours. No dashboard login is required to approve/reject.
    </p>
  </div>
</div>`;

  await sendEmail({ to: ownerEmail, subject, html });
}

async function sendOrganizerApprovedNotificationEmail(organizer) {
  const subject = '🎉 Your Organizer Account Has Been Approved!';
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#10b981,#059669);padding:24px;color:#ffffff;text-align:center;">
    <h2 style="margin:0;font-size:1.4rem;">Account Approved!</h2>
    <p style="margin:6px 0 0;font-size:0.9rem;opacity:0.9;">Welcome to Campus Event Finder</p>
  </div>
  <div style="padding:28px 24px;">
    <p style="font-size:1.05rem;color:#1e293b;">Hi <strong>${organizer.name}</strong>,</p>
    <p style="font-size:0.95rem;color:#334155;line-height:1.6;">
      Congratulations! Your <strong>Admin / Organizer</strong> account for <strong>${organizer.clubName || organizer.collegeName || 'your organization'}</strong> has been reviewed and <strong>approved</strong> by the platform administrator.
    </p>
    <p style="font-size:0.95rem;color:#334155;line-height:1.6;">
      You now have full access to:
    </p>
    <ul style="color:#475569;font-size:0.9rem;line-height:1.7;">
      <li>Publishing and managing campus events</li>
      <li>Live QR Attendance scanning &amp; verification</li>
      <li>Participant check-ins and registration tracking</li>
      <li>Automatic certificate generation</li>
    </ul>
    <p style="margin-top:24px;text-align:center;">
      <a href="${(process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')}/login" style="background:#4f46e5;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">
        Log In to Admin Dashboard
      </a>
    </p>
    <p style="color:#94a3b8;font-size:0.8rem;margin-top:32px;text-align:center;">Campus Event Finder &amp; Manager</p>
  </div>
</div>`;

  await sendEmail({ to: organizer.email, subject, html });
}

async function sendOrganizerRejectedNotificationEmail(organizer) {
  const subject = 'Organizer Account Request Update';
  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;">
  <div style="background:#64748b;padding:24px;color:#ffffff;text-align:center;">
    <h2 style="margin:0;font-size:1.4rem;">Organizer Request Update</h2>
    <p style="margin:6px 0 0;font-size:0.9rem;opacity:0.9;">Campus Event Finder &amp; Manager</p>
  </div>
  <div style="padding:28px 24px;">
    <p style="font-size:1.05rem;color:#1e293b;">Hi <strong>${organizer.name}</strong>,</p>
    <p style="font-size:0.95rem;color:#334155;line-height:1.6;">
      Thank you for your interest in organizing events on Campus Event Finder.
    </p>
    <p style="font-size:0.95rem;color:#334155;line-height:1.6;">
      Your request to register an <strong>Admin / Organizer</strong> account for <strong>${organizer.clubName || organizer.collegeName || 'your organization'}</strong> was not approved at this time.
    </p>
    <p style="font-size:0.9rem;color:#64748b;line-height:1.6;">
      If you believe this decision was made in error or if you need to provide additional club verification credentials, please contact the campus administrator.
    </p>
    <p style="color:#94a3b8;font-size:0.8rem;margin-top:32px;text-align:center;">Campus Event Finder &amp; Manager</p>
  </div>
</div>`;

  await sendEmail({ to: organizer.email, subject, html });
}

module.exports = {
  sendEmail,
  sendConfirmationEmail,
  sendReminderEmail,
  sendNewEventAnnouncement,
  sendAdminRegistrationAlert,
  sendFeedbackRequestEmail,
  sendWaitlistConfirmEmail,
  sendWaitlistPromotedEmail,
  sendEventCancellationEmail,
  sendOrganizerApprovalRequestEmail,
  sendOrganizerApprovedNotificationEmail,
  sendOrganizerRejectedNotificationEmail,
};


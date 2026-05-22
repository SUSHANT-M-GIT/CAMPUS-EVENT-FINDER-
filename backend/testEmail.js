/**
 * Standalone email test — run this directly to verify Brevo SMTP works.
 * Usage:  node testEmail.js
 *
 * This bypasses the entire Express app and tests ONLY the email transport.
 */
require("dotenv").config();
const nodemailer = require("nodemailer");

const TO      = process.env.BREVO_USER;   // send to yourself as a quick test
const FROM    = process.env.EMAIL_FROM || process.env.BREVO_USER;
const USER    = process.env.BREVO_USER;
const PASS    = process.env.BREVO_PASS;

console.log("=== Email Test ===");
console.log("BREVO_USER :", USER  || "❌ NOT SET");
console.log("BREVO_PASS :", PASS  ? PASS.slice(0, 10) + "..." : "❌ NOT SET");
console.log("EMAIL_FROM :", FROM  || "❌ NOT SET");
console.log("Sending to :", TO);
console.log("==================");

if (!USER || !PASS) {
  console.error("❌ Cannot send — BREVO_USER or BREVO_PASS missing in .env");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: { user: USER, pass: PASS },
});

transport.sendMail({
  from: FROM,
  to: TO,
  subject: "✅ Campus Event Finder — SMTP Test",
  html: `
    <div style="font-family:Arial,sans-serif;padding:24px;max-width:500px;">
      <h2 style="color:#4f46e5;">SMTP Test Successful!</h2>
      <p>Brevo SMTP is working correctly for Campus Event Finder.</p>
      <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
      <p><strong>From:</strong> ${FROM}</p>
      <p><strong>To:</strong> ${TO}</p>
    </div>`,
}).then((info) => {
  console.log("✅ SUCCESS — email sent!");
  console.log("   messageId:", info.messageId);
  console.log("   response :", info.response);
}).catch((err) => {
  console.error("❌ FAILED:", err.message);
  console.error("\nCommon causes:");
  console.error("  • BREVO_PASS is the API key, not the SMTP key");
  console.error("    → Go to Brevo → SMTP & API → SMTP tab → Generate SMTP key");
  console.error("  • BREVO_USER is wrong (must be your Brevo login email)");
  console.error("  • Port 587 blocked by firewall/ISP — try port 465 with secure:true");
});

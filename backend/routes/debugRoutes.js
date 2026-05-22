/**
 * DEBUG ROUTES — email diagnostics only.
 * Remove this file once emails are confirmed working.
 *
 * GET  /api/debug-email?to=you@example.com
 * GET  /api/debug-env
 */
const router     = require("express").Router();
const nodemailer = require("nodemailer");

// ── /api/debug-env ────────────────────────────────────────────────────────────
router.get("/debug-env", (req, res) => {
  const brevoUser = process.env.BREVO_USER || "";
  const brevoPass = process.env.BREVO_PASS || "";
  res.json({
    BREVO_USER_present : brevoUser.length > 0,
    BREVO_USER_value   : brevoUser || "(not set)",
    BREVO_PASS_present : brevoPass.length > 0,
    BREVO_PASS_preview : brevoPass.length > 6 ? brevoPass.slice(0,4)+"..."+brevoPass.slice(-4) : "(too short or missing)",
    EMAIL_FROM         : process.env.EMAIL_FROM || "(not set)",
    APP_URL            : process.env.APP_URL    || "(not set)",
    PORT               : process.env.PORT       || "(not set)",
  });
});

// ── /api/debug-email ─────────────────────────────────────────────────────────
router.get("/debug-email", async (req, res) => {
  const to = req.query.to;
  if (!to) return res.status(400).json({ error: "Provide ?to=your@email.com" });

  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_PASS;
  const from = process.env.EMAIL_FROM || "Campus Event Finder <noreply@test.com>";

  console.log("=== [debug-email] START ===");
  console.log(`  to   : ${to}`);
  console.log(`  from : ${from}`);
  console.log(`  user : ${user || "MISSING"}`);
  console.log(`  pass : ${pass ? pass.slice(0,4)+"..." : "MISSING"}`);

  if (!user || !pass) {
    console.error("  RESULT: ABORTED — BREVO_USER or BREVO_PASS not set");
    return res.status(500).json({ error: "BREVO_USER or BREVO_PASS not set in .env" });
  }

  try {
    const transport = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });

    const info = await transport.sendMail({
      from,
      to,
      subject: "✅ Campus Event Finder — Debug Test Email",
      html: `<div style="font-family:Arial,sans-serif;padding:24px;">
        <h2>Debug Test — Brevo SMTP</h2>
        <p>If you received this, Brevo is working correctly.</p>
        <p><strong>Sent at:</strong> ${new Date().toISOString()}</p>
        <p><strong>From:</strong> ${from}</p>
        <p><strong>To:</strong> ${to}</p>
      </div>`,
    });

    console.log("  RESULT: SUCCESS");
    console.log("  messageId:", info.messageId);
    console.log("  response :", info.response);
    console.log("=== [debug-email] END ===");

    return res.json({ success: true, messageId: info.messageId, response: info.response, to, from });

  } catch (err) {
    console.error("  RESULT: FAILED —", err.message);
    console.log("=== [debug-email] END ===");
    return res.status(500).json({ success: false, error: err.message, to, from });
  }
});

module.exports = router;

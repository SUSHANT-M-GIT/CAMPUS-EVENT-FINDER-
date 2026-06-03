# Bugfix Requirements Document

## Introduction

After a user fills the registration form, the frontend transitions to the OTP step and
displays "OTP sent to your college email." However, the OTP email is never delivered to
the user's inbox, making account verification impossible.

The root cause spans three layers:

1. **Transport mis-match** — `emailService.js` uses Brevo SMTP, but the `.env` template
   ships with placeholder values (`your_brevo_login_email@example.com` /
   `your_brevo_smtp_password`). When those are blank or invalid, `sendEmail` logs a skip
   message and returns `false` silently — no email is sent.
2. **Silent failure in the controller** — `authController.js` calls `sendOtpEmail()` with
   `.catch()` only, so a delivery failure is swallowed. The HTTP response is sent
   regardless, carrying no signal that the email failed.
3. **Frontend always shows success** — `SignupPage.tsx` transitions to the OTP step and
   sets the success banner as soon as the `/api/auth/register` request resolves (HTTP 200),
   without checking whether the email was actually delivered.
4. **Email provider mis-match with stated constraints** — the requirements specify
   `nodemailer` with `service: "gmail"` and `EMAIL_USER` / `EMAIL_PASS` (Gmail App
   Password), but the codebase uses Brevo SMTP with `BREVO_USER` / `BREVO_PASS`.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user submits the registration form with a valid institutional email THEN the
system calls `sendOtpEmail()` as a fire-and-forget promise (`.catch()` only), so any
SMTP delivery failure is silently swallowed and never surfaced to the caller.

1.2 WHEN `BREVO_USER` or `BREVO_PASS` is missing, empty, or set to a placeholder value in
`.env` THEN the system logs `[Email] SKIP — BREVO_USER or BREVO_PASS not set` and
returns `false` without throwing, causing the OTP to be stored in the database but
never emailed to the user.

1.3 WHEN `BREVO_USER` / `BREVO_PASS` are set but incorrect (wrong credentials) THEN the
system catches the SMTP error internally, logs it, and returns `false` — again without
propagating the failure to the HTTP response.

1.4 WHEN the `/api/auth/register` endpoint returns HTTP 200 regardless of email delivery
outcome THEN the frontend receives a successful response and unconditionally transitions
to the OTP step, showing "OTP sent to your college email."

1.5 WHEN the frontend renders the OTP step after a successful HTTP 200 response THEN the
system displays a success banner ("OTP sent to your college email") even though no email
was delivered, misleading the user into waiting for an email that will never arrive.

1.6 WHEN `emailService.js` is configured with `service: "gmail"` / `EMAIL_USER` /
`EMAIL_PASS` as specified in the requirements THEN the current transport configuration
(`smtp-relay.brevo.com`, `BREVO_USER`, `BREVO_PASS`) does not match, so the intended
Gmail App Password flow cannot work without reconfiguring the transport.

### Expected Behavior (Correct)

2.1 WHEN a user submits the registration form THEN the system SHALL await `sendOtpEmail()`
inside a `try/catch` block so that any SMTP delivery failure is caught and propagated
rather than silently swallowed.

2.2 WHEN the SMTP send succeeds THEN the system SHALL log "OTP email sent" and include
`{ success: true }` in the HTTP response alongside the existing `msg` and `email` fields.

2.3 WHEN the SMTP send fails for any reason (missing credentials, bad credentials, network
error) THEN the system SHALL log "OTP SEND ERROR: <error message>", return HTTP 500 with
`{ success: false, message: "Failed to send OTP email" }`, and NOT transition the user
forward in the UI.

2.4 WHEN `EMAIL_USER` or `EMAIL_PASS` is missing or empty at send time THEN the system
SHALL log a descriptive error and return `{ success: false }` rather than silently
skipping.

2.5 WHEN the frontend receives a response with `response.data.success === true` THEN the
system SHALL transition to the OTP entry step and display the success banner.

2.6 WHEN the frontend receives a response with `response.data.success === false` or any
error response THEN the system SHALL remain on the registration form and display an error
message explaining that the OTP email could not be sent.

2.7 WHEN `emailService.js` is updated THEN the system SHALL use
`nodemailer.createTransport` with `service: "gmail"` and authenticate with
`process.env.EMAIL_USER` (Gmail address) and `process.env.EMAIL_PASS` (Gmail App
Password), as specified in the project requirements.

2.8 WHEN an OTP send is initiated THEN the system SHALL log "Sending OTP to: <email>" and
"Generated OTP: <otp>" before attempting delivery, to aid debugging.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user submits a valid institutional email and the OTP email is delivered
successfully THEN the system SHALL CONTINUE TO store the OTP and its expiry in the
database and return the appropriate HTTP 200 response with the email field.

3.2 WHEN a user enters the correct OTP within the 10-minute window THEN the system SHALL
CONTINUE TO mark the account as verified, clear the OTP fields, and allow login.

3.3 WHEN a user enters an expired or incorrect OTP THEN the system SHALL CONTINUE TO
return the appropriate error message without verifying the account.

3.4 WHEN a user requests OTP resend THEN the system SHALL CONTINUE TO generate a new OTP,
update the expiry, and attempt delivery; failure SHALL be surfaced the same way as the
initial send failure.

3.5 WHEN a user registers with a personal email domain (gmail.com, yahoo.com, hotmail.com,
outlook.com, live.com, icloud.com, protonmail.com) THEN the system SHALL CONTINUE TO
reject the request with the existing blocked-domain error message.

3.6 WHEN a user registers with any institutional/college email domain not in the blocked
list THEN the system SHALL CONTINUE TO accept the email regardless of domain (multi-college
support preserved; no domain hardcoding).

3.7 WHEN a verified user logs in THEN the system SHALL CONTINUE TO issue a JWT, apply
role-based routing (admin → /admin, student → /user), and enforce all existing auth
middleware and role guards.

3.8 WHEN any non-OTP email (confirmation, reminder, announcement, feedback request,
cancellation, waitlist) is sent via `emailService.js` THEN the system SHALL CONTINUE TO
use the same transport; their behavior SHALL NOT be affected by the OTP transport change.

3.9 WHEN the payment verification workflow, event management, registration flow,
notification system, or Socket.IO real-time features are used THEN the system SHALL
CONTINUE TO function exactly as before.

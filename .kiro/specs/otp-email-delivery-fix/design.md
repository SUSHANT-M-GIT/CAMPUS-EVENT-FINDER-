# OTP Email Delivery Bugfix Design

## Overview

The OTP email delivery bug spans three layers:

1. **emailService.js** uses Brevo SMTP, but the project requirements specify Gmail transport
   (`service: "gmail"` with `EMAIL_USER` / `EMAIL_PASS`). The current `sendEmail` helper
   also silently returns `false` when credentials are absent rather than throwing, so
   callers have no way to detect failure by catching an exception.

2. **authController.js** calls `sendOtpEmail()` as a fire-and-forget promise (`.catch()`
   only). A delivery failure is swallowed; the HTTP response is `200 OK` regardless.

3. **SignupPage.tsx** transitions to the OTP step and shows "OTP sent" as soon as the
   `POST /api/auth/register` request resolves (HTTP 200), without inspecting
   `response.data.success`.

The fix is surgical: replace the transport in `emailService.js`, add a hard guard for
missing credentials, await the OTP send in `authController.js` with a try/catch, and gate
the step-transition in `SignupPage.tsx` on `response.data.success === true`. No other
email paths, routes, or features are touched.

---

## Glossary

- **Bug_Condition (C)**: The set of runtime states in which an OTP email silently fails to
  deliver while the user is told it succeeded. Formally, any registration attempt where
  `sendOtpEmail` fails (throws or returns false) AND the frontend still transitions to the
  OTP step.
- **Property (P)**: The desired outcome for all inputs where C holds after the fix is
  applied — the controller returns `{ success: false }` / HTTP 500, and the frontend stays
  on the registration form.
- **Preservation**: All behaviors unrelated to the OTP transport change that must remain
  identical before and after the fix.
- **sendOtpEmail**: The local helper in `authController.js` (lines ~32-55) that composes
  the OTP HTML email and delegates to `emailService.sendEmail`.
- **sendEmail**: The core send function in `backend/services/emailService.js` that creates
  the Nodemailer transport and calls `transporter.sendMail`.
- **getTransport**: Factory function in `emailService.js` that constructs the Nodemailer
  transport object — this is the primary target of the transport change.
- **isBugCondition**: Pseudocode predicate used in this document to identify whether a
  given runtime state falls in the bug set C.
- **signup (AuthContext)**: The context function in `AuthContext.tsx` that calls
  `signupRequest` and returns `response.msg`. After the fix it must also propagate
  `response.success` so `SignupPage.tsx` can gate the step transition.

---

## Bug Details

### Bug Condition

The bug manifests when a user submits the registration form with a valid institutional
email. `authController.js` does not await the result of `sendOtpEmail`, so any SMTP
failure is discarded. Even when `emailService.js` guards for missing credentials it
returns `false` silently instead of throwing, meaning the try/catch in the controller
(once added) would never see an error from a missing-credentials path unless `sendEmail`
is changed to throw.

**Formal Specification:**
```
FUNCTION isBugCondition(runtimeState)
  INPUT: runtimeState = { emailUser, emailPass, smtpError, controllerAwaits, frontendChecksSuccess }
  OUTPUT: boolean

  credentialsMissing  := NOT emailUser OR NOT emailPass
  smtpFails          := credentialsMissing OR smtpError IS NOT NULL
  controllerIgnores  := NOT controllerAwaits           -- fire-and-forget
  frontendBlind      := NOT frontendChecksSuccess      -- always transitions to OTP step

  RETURN smtpFails AND (controllerIgnores OR frontendBlind)
END FUNCTION
```

### Examples

| # | Scenario | Before fix | After fix |
|---|----------|-----------|-----------|
| 1 | `EMAIL_USER`/`EMAIL_PASS` absent in `.env` | `sendEmail` logs "SKIP", returns `false`; controller sends HTTP 200; frontend shows "OTP sent" | `getTransport()` throws descriptive error; controller catches it, returns HTTP 500 `{ success: false }`; frontend stays on form |
| 2 | Gmail App Password is wrong | SMTP auth error logged, swallowed; HTTP 200 sent | Error propagates; HTTP 500 returned; frontend stays on form |
| 3 | Network unreachable | SMTP timeout logged, swallowed; HTTP 200 sent | Error propagates; HTTP 500 returned; frontend stays on form |
| 4 | Valid Gmail credentials, send succeeds | HTTP 200, frontend transitions (correct by accident) | HTTP 200 `{ success: true }`; frontend transitions (correct and explicit) |

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `sendConfirmationEmail`, `sendReminderEmail`, `sendNewEventAnnouncement`,
  `sendAdminRegistrationAlert`, `sendFeedbackRequestEmail`, `sendWaitlistConfirmEmail`,
  `sendWaitlistPromotedEmail`, `sendEventCancellationEmail` — all continue to use the same
  shared transport returned by `getTransport()`. Their call signatures and HTML output are
  not modified.
- The `sendEmail` soft-failure behaviour (return `false` instead of throw) is kept for all
  non-OTP callers so that a missed confirmation or reminder email does not crash a
  controller response. Only the credential-guard path is changed to throw eagerly (before
  any sendMail attempt) so the OTP caller can rely on a thrown error.
- Blocked-domain validation in `authController.js` is not touched.
- Multi-college institutional email acceptance is not touched.
- OTP generation, database storage (`u.otp`, `u.otpExpiry`), and the verify/resend
  endpoints are not touched.
- JWT issuance and role-based routing (admin → `/admin`, student → `/user`) are not
  touched.
- Payment workflow, event management, registration flow, notification system, and
  Socket.IO features are not touched.

**Scope of impact:**
Only inputs that go through the `POST /api/auth/register` code path that calls
`sendOtpEmail` are affected by the controller change. Only inputs that use `getTransport`
are affected by the transport change (which is all email paths — but the transport
interface is identical; only the provider differs).

---

## Hypothesized Root Cause

1. **Wrong transport provider**: `getTransport()` hard-codes Brevo SMTP
   (`smtp-relay.brevo.com:587`) but the project requirements and `.env` template reference
   `EMAIL_USER`/`EMAIL_PASS` (Gmail App Password). The env vars the code reads
   (`BREVO_USER`/`BREVO_PASS`) are never populated in practice.

2. **Silent credential guard**: The `sendEmail` function checks for missing credentials
   and returns `false` rather than throwing. This means a `try/catch` around the caller
   would never see an error for the missing-credentials case.

3. **Fire-and-forget call in register**: `authController.register` calls
   `sendOtpEmail(...).catch(...)` without `await`, so the result of the send (success or
   failure) is completely decoupled from the HTTP response.

4. **Frontend doesn't inspect `success` field**: `SignupPage.tsx` calls `await signup()`
   and, if no exception is thrown, unconditionally calls `setStep("otp")`. The `signup`
   helper in `AuthContext.tsx` returns only `response.msg`, discarding `response.success`.
   Even if the backend were fixed to return `{ success: false }`, the frontend would still
   transition to the OTP step because the HTTP status is still `200 OK` in the current
   buggy controller (not 500), and the data shape is not checked.

---

## Correctness Properties

Property 1: Bug Condition — OTP Send Failure Surfaces to Caller

_For any_ registration request where `sendOtpEmail` fails (SMTP error, missing
`EMAIL_USER`/`EMAIL_PASS`, network error), the fixed `register` controller SHALL catch the
error, return HTTP 500 with `{ success: false, message: "Failed to send OTP email" }`, and
NOT transition the frontend to the OTP step.

**Validates: Requirements 2.1, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation — Non-OTP Email Behavior Unchanged

_For any_ call to a non-OTP email helper (`sendConfirmationEmail`, `sendReminderEmail`,
`sendNewEventAnnouncement`, `sendAdminRegistrationAlert`, `sendFeedbackRequestEmail`,
`sendWaitlistConfirmEmail`, `sendWaitlistPromotedEmail`, `sendEventCancellationEmail`) with
the same arguments, the fixed `emailService.js` SHALL invoke `transporter.sendMail` with
the same `{ from, to, subject, html }` shape as the original, preserving all non-OTP email
behavior.

**Validates: Requirements 3.8**

Property 3: Preservation — Registration Happy Path Unchanged

_For any_ registration request where `sendOtpEmail` succeeds, the fixed controller SHALL
return HTTP 200 with `{ success: true, msg: "...", email: "..." }`, the OTP SHALL be stored
in the database with a valid expiry, and the frontend SHALL transition to the OTP step.

**Validates: Requirements 2.2, 3.1**

Property 4: Preservation — Blocked Domain Rejection Unchanged

_For any_ registration request with an email whose domain is in
`["gmail.com","yahoo.com","hotmail.com","outlook.com","live.com","icloud.com","protonmail.com"]`,
the fixed controller SHALL return HTTP 400 with the existing blocked-domain error message,
identical to pre-fix behavior.

**Validates: Requirements 3.5**

Property 5: Preservation — Institutional Domain Acceptance Unchanged

_For any_ registration request with an email whose domain is NOT in the blocked list, the
fixed controller SHALL NOT reject the request on domain grounds, preserving multi-college
support.

**Validates: Requirements 3.6**

---

## Fix Implementation

### Changes Required

#### File 1: `backend/services/emailService.js`

**Function**: `getTransport` and `sendEmail`

**Specific Changes:**

1. **Replace transport provider**: Change `getTransport()` from Brevo SMTP to Gmail:
   ```js
   function getTransport() {
     const user = process.env.EMAIL_USER;
     const pass = process.env.EMAIL_PASS;
     if (!user || !pass) {
       throw new Error(
         "[Email] EMAIL_USER or EMAIL_PASS is not set in .env — " +
         "Gmail transport cannot be initialised. " +
         "Set EMAIL_USER to your Gmail address and EMAIL_PASS to a Gmail App Password."
       );
     }
     return nodemailer.createTransport({
       service: "gmail",
       auth: { user, pass },
     });
   }
   ```

2. **Remove duplicate credential guard from `sendEmail`**: The `if (!user || !pass)`
   check inside `sendEmail` becomes redundant once `getTransport()` throws eagerly. Remove
   it and the early-return `false` so that a missing-credentials failure is surfaced as a
   thrown error (which the OTP controller will catch) rather than a silent `false` return.

3. **Retain soft try/catch for non-OTP callers**: Keep the outer `try/catch` in
   `sendEmail` that logs and returns `false` on SMTP error. Non-OTP callers rely on this
   soft behaviour; they do not propagate failures to the HTTP response.

   > **Note**: This means the OTP controller must re-throw or detect failure itself.
   > Because `sendEmail` still catches internally, `sendOtpEmail` should call `sendEmail`
   > and check its return value, throwing if it returns `false`, OR `sendOtpEmail` should
   > call `transporter.sendMail` directly (bypassing the soft catch). The simpler approach
   > is: make `sendEmail` throw on failure when called from a context that needs the error
   > — but that breaks the soft-failure contract for other callers.
   >
   > **Recommended approach**: Introduce a separate `sendEmailOrThrow` (or simply expose
   > the throw path via an `{ strict: true }` option), used only by `sendOtpEmail`. This
   > keeps the existing soft-failure behaviour intact for all other callers.
   >
   > **Simpler alternative**: Expose `getTransport` and let `sendOtpEmail` in
   > `authController.js` call `getTransport().sendMail(...)` directly, bypassing the
   > soft-catch in `sendEmail`. This is the approach detailed below.

4. **Update env var references**: Replace all references to `BREVO_USER`/`BREVO_PASS` in
   diagnostic logs with `EMAIL_USER`/`EMAIL_PASS`.

5. **Update `module.exports`**: No change needed — existing exports remain.

---

#### File 2: `backend/controllers/authController.js`

**Function**: `exports.register` and `exports.resendOtp`

**Specific Changes:**

1. **Add debug logs before send** (requirement 2.8):
   ```js
   console.log("Sending OTP to:", email);
   console.log("Generated OTP:", otp);
   ```

2. **Await `sendOtpEmail` inside a try/catch** (replaces the fire-and-forget `.catch()`):
   ```js
   try {
     await sendOtpEmail(email, otp, name);
     return res.status(200).json({
       success: true,
       msg: "OTP sent to your email. Please verify to complete registration.",
       email,
     });
   } catch (emailErr) {
     console.error("OTP SEND ERROR:", emailErr.message);
     return res.status(500).json({
       success: false,
       message: "Failed to send OTP email",
     });
   }
   ```

3. **Make `sendOtpEmail` throw on failure**: Change the local helper so that if
   `sendEmail` returns `false` it throws, or call `getTransport().sendMail(...)` directly
   so the credential guard in `getTransport` propagates naturally.

4. **Apply the same try/catch pattern to `exports.resendOtp`** (requirement 3.4) for
   consistency — failure should surface identically on resend.

---

#### File 3: `frontend/src/context/AuthContext.tsx`

**Function**: `signup`

**Specific Changes:**

1. **Return full response data** instead of just `response.msg`:
   ```ts
   const signup = useCallback(async ({ name, email, password, role, collegeName }: SignupInput) => {
     const response = await signupRequest({ name, email, password, role, collegeName });
     return response; // { success, msg, email } or { success, message }
   }, []);
   ```

2. **Update `AuthContextValue` interface** — change `signup` return type from
   `Promise<string>` to `Promise<{ success: boolean; msg?: string; message?: string; email?: string }>`.

---

#### File 4: `frontend/src/services/authService.ts`

**Function**: `signup`

**Specific Changes:**

1. **Widen the response type** to include `success`:
   ```ts
   export async function signup(payload: SignupPayload) {
     const { data } = await api.post<{ success: boolean; msg?: string; message?: string; email?: string }>(
       "/auth/register", payload
     );
     return data;
   }
   ```

---

#### File 5: `frontend/src/pages/SignupPage.tsx`

**Function**: `handleSubmit`

**Specific Changes:**

1. **Gate OTP step transition on `success === true`**:
   ```ts
   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
     e.preventDefault();
     const err = validateEmail(form.email);
     if (err) { setEmailError(err); return; }
     setError(""); setSuccess(""); setLoading(true);
     try {
       const response = await signup(form as any);
       if (response.success === true) {
         setPendingEmail(form.email);
         setStep("otp");
         setSuccess("OTP sent to your college email. Enter it below.");
       } else {
         setError(response.message || response.msg || "Failed to send OTP email. Please try again.");
       }
     } catch (err: any) {
       setError(err.response?.data?.message || err.response?.data?.msg || err.message || "Something went wrong.");
     } finally {
       setLoading(false);
     }
   };
   ```

2. **Keep all other step logic unchanged** — `handleVerify`, `handleResend`, the
   "Change email" button, and the OTP UI are not modified.

---

#### File 6: `backend/.env` (documentation only)

Add the Gmail transport variables and mark the Brevo variables as deprecated:

```
# ─── Email (Gmail SMTP via Nodemailer) ────────────────────────────────────────
# Use a Gmail App Password — NOT your normal Gmail password.
# Steps: Google Account → Security → 2-Step Verification → App passwords
# Generate a 16-char App Password for "Mail" / "Other (custom name)".
EMAIL_USER=yourgmail@gmail.com
EMAIL_PASS=your_16_char_gmail_app_password

# Sender display name shown in emails
EMAIL_FROM=Campus Event Finder <noreply@campuseventfinder.com>

# ─── Deprecated (Brevo SMTP — no longer used) ────────────────────────────────
# BREVO_USER=your_brevo_login_email@example.com
# BREVO_PASS=your_brevo_smtp_password
```

---

## Testing Strategy

### Validation Approach

Testing follows the two-phase bug condition methodology:

1. **Exploratory phase** — run tests on the *unfixed* code to observe and characterise the
   failure modes (surface counterexamples for C(X)).
2. **Fix + preservation phase** — run the same tests after the fix to confirm Property 1
   (bug fixed) and Property 2-5 (no regressions).

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix.
Confirm or refute the four root causes identified above.

**Test Plan**: Mock Nodemailer's `createTransport` to throw (simulating missing/bad
credentials), call `POST /api/auth/register` with a valid institutional email, and assert
that the HTTP response on unfixed code is `200 OK` with no `success` field — confirming
the fire-and-forget swallow.

**Test Cases:**

1. **Missing credentials test** — set `EMAIL_USER`/`EMAIL_PASS` to `undefined`, call
   `register`. On unfixed code: returns HTTP 200, `{ msg: "OTP sent…", email }`. Confirms
   root cause #1 and #2 (wrong transport + silent guard). *(will fail on unfixed code to
   surface the bug)*

2. **SMTP auth failure test** — set valid-format but wrong credentials, mock
   `transporter.sendMail` to reject with `Error("Invalid login")`, call `register`. On
   unfixed code: returns HTTP 200. Confirms root cause #3 (fire-and-forget). *(will fail
   on unfixed code)*

3. **Frontend blind transition test** — mock `/api/auth/register` to respond with
   `{ msg: "OTP sent…", email }` (no `success` field), render `SignupPage`, submit form.
   On unfixed code: `step` becomes `"otp"`. Confirms root cause #4 (frontend doesn't
   check `success`). *(will fail on unfixed code)*

4. **`success: false` ignored by frontend test** — mock endpoint to return
   `{ success: false, message: "Failed to send OTP email" }` with HTTP 200 (intermediate
   state). On unfixed code: `step` still becomes `"otp"` because `AuthContext.signup`
   returns only `response.msg`. *(will fail on unfixed code)*

**Expected Counterexamples:**
- HTTP 200 responses when the email transport fails
- `step === "otp"` in the frontend regardless of `success` value
- No `OTP SEND ERROR` log in the controller output

---

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (C(X) = true), the
fixed code produces the expected behavior (Property 1).

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := register_fixed(request)
  ASSERT response.status === 500
  ASSERT response.body.success === false
  ASSERT response.body.message === "Failed to send OTP email"
  ASSERT frontend.step === "form"
  ASSERT frontend.errorMessage IS NOT EMPTY
END FOR
```

**Test cases** (on fixed code):
1. SMTP unavailable → HTTP 500, `success: false`, frontend stays on form
2. `EMAIL_USER` missing → `getTransport` throws, HTTP 500, `success: false`
3. `EMAIL_PASS` missing → `getTransport` throws, HTTP 500, `success: false`
4. `transporter.sendMail` rejects → HTTP 500, `success: false`

---

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (C(X) = false),
the fixed code produces the same result as the original (Properties 2–5).

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT register_original(request) ≈ register_fixed(request)
  -- (same HTTP status, same body shape, same DB side-effects)
END FOR
```

**Testing Approach**: Property-based testing is recommended for the non-OTP email
preservation property (Property 2) because the helpers accept many combinations of event
data. For the controller preservation properties (3–5), example-based unit tests are
sufficient since the input space is well-bounded.

**Test Cases:**

1. **Successful OTP delivery preservation** — mock `sendMail` to resolve; assert HTTP 200
   `{ success: true, msg, email }`, OTP stored in DB with expiry ~10 min out.

2. **Non-OTP email preservation (PBT)** — generate random `{ to, event, registration }`
   objects; for each non-OTP helper, assert `transporter.sendMail` is called with the same
   `from`/`to`/`subject`/`html` shape before and after the transport change (only the
   host/auth config changes, not the send interface).

3. **Blocked domain preservation** — for each domain in the blocked list, assert HTTP 400
   with the existing error message, same as before the fix.

4. **Institutional domain acceptance preservation** — for a sample of non-blocked domains
   (`.edu`, `.ac.in`, `.org`, etc.), assert the request proceeds past domain validation.

5. **OTP verify/resend flow preservation** — submit correct OTP within expiry window →
   `isVerified: true`, OTP cleared. Submit expired OTP → 400 error. Submit wrong OTP →
   400 error. All identical to pre-fix.

6. **Role-based routing preservation** — after verified login, admin user gets token with
   `role: "admin"`, student gets `role: "student"`.

---

### Unit Tests

- `getTransport()` throws when `EMAIL_USER` is absent
- `getTransport()` throws when `EMAIL_PASS` is absent
- `getTransport()` returns a transport with `service: "gmail"` when both vars are set
- `register` with mocked send success → HTTP 200 `{ success: true, msg, email }`
- `register` with mocked send failure → HTTP 500 `{ success: false, message }`
- `register` with blocked domain email → HTTP 400, no OTP generated
- `register` with unverified existing account → refreshes OTP, attempts send
- `verifyEmail` with correct OTP within expiry → marks verified, clears OTP fields
- `verifyEmail` with expired OTP → returns 400 "OTP has expired"
- `resendOtp` with mocked send failure → HTTP 500 (after fix is applied to resend too)
- `SignupPage handleSubmit` with `success: true` response → step transitions to `"otp"`
- `SignupPage handleSubmit` with `success: false` response → step stays `"form"`, error shown
- `SignupPage handleSubmit` with axios error → step stays `"form"`, error shown

---

### Property-Based Tests

- **Property 1 (Fix Check)**: For any call to `register` where `sendMail` throws, the
  response SHALL have `status === 500` and `body.success === false`.

- **Property 2 (Non-OTP Preservation)**: For any `{ to, subject, html }` passed to
  `sendEmail`, the nodemailer `sendMail` call SHALL receive `{ from, to, subject, html }`
  unchanged — `from` derived from `EMAIL_FROM` env var, others passed through verbatim.

- **Property 4 (Blocked Domain)**: For any email address whose domain is in the blocked
  list, `register` SHALL return HTTP 400, regardless of name, password, collegeName, or
  role values.

- **Property 5 (Institutional Domain)**: For any email address whose domain is NOT in the
  blocked list and passes format validation, `register` SHALL not reject on domain grounds
  (may still fail for other reasons such as missing body fields).

---

### Integration Tests

- Full registration → OTP email sent (using a real Gmail App Password in a test env) →
  OTP entry → account verified → login succeeds → role-based redirect works.
- Full registration → bad Gmail credentials → HTTP 500 → frontend stays on form → user
  sees error message.
- Resend OTP → new OTP replaces old in DB → old OTP no longer valid → new OTP verifies.
- Non-OTP email flow: register for event → confirmation email sent via same Gmail transport.
- Blocked domain registration attempt → rejected before any OTP or DB write.

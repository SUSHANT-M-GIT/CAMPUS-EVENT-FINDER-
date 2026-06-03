import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { verifyEmail, resendOtp } from "../services/authService";

// Mirrors backend validation exactly
const FORMAT_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Blocked for students only — admins may use any valid email
const STUDENT_BLOCKED_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "live.com", "icloud.com", "protonmail.com"];

function validateEmail(email: string, role: string): string | null {
  if (!FORMAT_RE.test(email)) return "Invalid email format";
  // Only apply domain restriction for students
  if (role !== "admin") {
    const domain = email.split("@")[1].toLowerCase();
    if (STUDENT_BLOCKED_DOMAINS.includes(domain))
      return "Personal email addresses (Gmail, Yahoo, Hotmail, Outlook) are not allowed. Please use your institutional/college email.";
  }
  return null;
}

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate   = useNavigate();

  // Step 1 — registration form
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student", collegeName: "" });
  // Step 2 — OTP verification
  const [step, setStep]         = useState<"form" | "otp">("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp]           = useState("");

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [emailError, setEmailError] = useState("");

  const handleEmailBlur = () => {
    if (form.email) {
      setEmailError(validateEmail(form.email, form.role) || "");
    } else {
      setEmailError("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      // Re-validate email immediately when role changes (domain rules differ)
      if (name === "role" && prev.email) {
        setEmailError(validateEmail(prev.email, value) || "");
      }
      return updated;
    });
    if (name === "email") setEmailError("");
  };

  // ── Step 1: submit registration ──────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateEmail(form.email, form.role);
    if (err) { setEmailError(err); return; }
    setError(""); setSuccess(""); setLoading(true);
    try {
      const result = await signup(form as any);
      // Only proceed to OTP step if backend confirms success
      setPendingEmail(form.email);
      setStep("otp");
      setSuccess("OTP sent to your college email. Enter it below.");
    } catch (err: any) {
      // Show exact error from backend (e.g. email delivery failure)
      setError(err.response?.data?.msg || err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP ───────────────────────────────────────────────────
  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await verifyEmail(pendingEmail, otp);
      setSuccess(res.msg);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.msg || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await resendOtp(pendingEmail);
      // Only show success if backend confirmed email was sent
      setSuccess(res.msg || "New OTP sent successfully.");
    } catch (err: any) {
      setError(err.response?.data?.msg || "Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const lbl = (text: string) => (
    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>{text}</label>
  );

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎓</div>
          <h1 style={{ fontSize: "1.6rem" }}>{step === "form" ? "Create your account" : "Verify your email"}</h1>
          <p>{step === "form" ? "Join Campus Event Finder today" : `OTP sent to ${pendingEmail}`}</p>
        </div>

        {error   && <Alert type="error"   message={error} />}
        {success && <Alert type="success" message={success} />}

        {/* ── STEP 1: Registration form ── */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              {lbl("Full name")}
              <input name="name" value={form.name} onChange={handleChange} placeholder="Jane Smith" className="input" required />
            </div>
            <div>
              {lbl("Email address")}
              <input
                type="text"
                name="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleEmailBlur}
                placeholder={form.role === "admin" ? "organizer@gmail.com or admin@company.com" : "you@college.edu or you@university.ac.in"}
                className="input"
                required
                style={emailError ? { borderColor: "#ef4444", boxShadow: "0 0 0 3px rgba(239,68,68,0.15)" } : {}}
              />
              {emailError
                ? <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#ef4444" }}>⚠ {emailError}</p>
                : form.role !== "admin"
                  ? <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Personal emails (Gmail, Yahoo, Outlook) are not accepted</p>
                  : <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Any valid email is accepted for admin accounts</p>
              }
            </div>
            <div>
              {lbl(form.role === "admin" ? "College / Organisation name" : "College / University name")}
              <input name="collegeName" value={form.collegeName} onChange={handleChange} placeholder={form.role === "admin" ? "e.g. Reva University / Tech Club" : "e.g. Reva University"} className="input" required />
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Cannot be changed after account creation</p>
            </div>
            <div>
              {lbl("Password")}
              <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="Min. 6 characters" className="input" required minLength={6} autoComplete="new-password" />
            </div>
            <div>
              {lbl("I am a…")}
              <select name="role" value={form.role} onChange={handleChange} className="input" required>
                <option value="student">Student</option>
                <option value="admin">Admin / Organizer</option>
              </select>
            </div>
            <button type="submit" disabled={loading || !!emailError} className="btn btn-gradient full-width" style={{ marginTop: 4, padding: 13, fontSize: "1rem" }}>
              {loading ? "Sending OTP…" : "Create Account →"}
            </button>
          </form>
        )}

        {/* ── STEP 2: OTP verification ── */}
        {step === "otp" && (
          <form onSubmit={handleVerify} className="auth-form">
            <div>
              {lbl("Enter the 6-digit OTP")}
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="input"
                maxLength={6}
                required
                style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: 10, fontWeight: 700 }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>OTP expires in 10 minutes</p>
            </div>
            <button type="submit" disabled={loading || otp.length !== 6} className="btn btn-gradient full-width" style={{ padding: 13, fontSize: "1rem" }}>
              {loading ? "Verifying…" : "Verify Email →"}
            </button>
            <button type="button" onClick={handleResend} disabled={loading} className="btn btn-secondary full-width" style={{ fontSize: "0.9rem" }}>
              Resend OTP
            </button>
            <button type="button" onClick={() => { setStep("form"); setOtp(""); setError(""); setSuccess(""); }} style={{ background: "none", border: 0, color: "#94a3b8", fontSize: "0.85rem", cursor: "pointer", textAlign: "center" }}>
              ← Change email
            </button>
          </form>
        )}

        <p className="auth-footnote">Already have an account? <Link to="/login">Sign in</Link></p>
        <p className="auth-footnote" style={{ marginTop: 8 }}>
          <Link to="/" style={{ color: "#94a3b8", fontSize: "0.85rem" }}>← Back to home</Link>
        </p>
      </section>
    </main>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { verifyEmail, resendOtp } from "../services/authService";

const FORMAT_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function validateEmail(email: string): string | null {
  if (!FORMAT_RE.test(email)) return "Invalid email format";
  return null;
}

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate   = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "student", collegeName: "", collegeId: "" });
  const [step, setStep]         = useState<"form" | "otp">("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [emailError, setEmailError] = useState("");

  const handleEmailBlur = () => {
    if (form.email) setEmailError(validateEmail(form.email) || "");
    else setEmailError("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => {
      if (name === "role" && prev.email) setEmailError(validateEmail(prev.email) || "");
      return { ...prev, [name]: value };
    });
    if (name === "email") setEmailError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const err = validateEmail(form.email);
    if (err) { setEmailError(err); return; }
    setError(""); setSuccess(""); setLoading(true);
    try {
      await signup(form as any);
      setPendingEmail(form.email);
      setStep("otp");
      setSuccess("OTP sent to your email. Enter it below.");
    } catch (err: any) {
      setError(err.response?.data?.msg || err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

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
      setSuccess(res.msg || "New OTP sent successfully.");
    } catch (err: any) {
      setError(err.response?.data?.msg || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const lbl = (text: string) => (
    <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 6 }}>{text}</label>
  );

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#4f46e5,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", margin: "0 auto 14px", boxShadow: "0 8px 24px rgba(79,70,229,0.4)" }}>
            <Zap size={24} color="#fff" fill="#fff" />
          </div>
          <h1 style={{ fontSize: "1.6rem", margin: "0 0 6px", color: "var(--text)", letterSpacing: "-0.025em" }}>
            {step === "form" ? "Create your account" : "Verify your email"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>
            {step === "form" ? "Join Campus Event Finder today" : `OTP sent to ${pendingEmail}`}
          </p>
        </div>

        {error   && <Alert type="error"   message={error} />}
        {success && <Alert type="success" message={success} />}

        {/*  STEP 1: Registration form  */}
        {step === "form" && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              {lbl("Full name")}
              <input name="name" value={form.name} onChange={handleChange} placeholder="Jane Smith" className="input" required />
            </div>
            <div>
              {lbl("Email address")}
              <input
                type="text" name="email" value={form.email}
                onChange={handleChange} onBlur={handleEmailBlur}
                placeholder={form.role === "admin" ? "organizer@gmail.com or admin@company.com" : "you@gmail.com or you@college.edu"}
                className="input" required
                style={emailError ? { borderColor: "#ef4444", boxShadow: "0 0 0 3px rgba(239,68,68,0.15)" } : {}}
              />
              {emailError
                ? <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#ef4444" }}> {emailError}</p>
                : <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-dim)" }}>Any valid email accepted — Gmail, college email, etc.</p>
              }
            </div>
            <div>
              {lbl(form.role === "admin" ? "College / Organisation name" : "College / University name")}
              <input name="collegeName" value={form.collegeName} onChange={handleChange}
                placeholder={form.role === "admin" ? "e.g. Reva University / Tech Club" : "e.g. Reva University"}
                className="input" required />
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-dim)" }}>Cannot be changed after account creation</p>
            </div>
            {form.role === "student" && (
              <div>
                {lbl("College ID / Roll Number")}
                <input name="collegeId" value={form.collegeId} onChange={handleChange}
                  placeholder="e.g. R23EJ125"
                  className="input" required />
                <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-dim)" }}>Used to verify your identity at events</p>
              </div>
            )}
            <div>
              {lbl("Password")}
              <input type="password" name="password" value={form.password} onChange={handleChange}
                placeholder="Min. 6 characters" className="input" required minLength={6} autoComplete="new-password" />
            </div>
            <div>
              {lbl("I am a")}
              <select name="role" value={form.role} onChange={handleChange} className="input" required>
                <option value="student">Student</option>
                <option value="admin">Admin / Organizer</option>
              </select>
            </div>
            <button type="submit" disabled={loading || !!emailError} className="btn btn-gradient full-width" style={{ marginTop: 4, padding: 13, fontSize: "1rem" }}>
              {loading ? "Sending OTP…" : <>Create Account <ArrowRight size={14} style={{ verticalAlign: "middle", marginLeft: 4 }} /></>}
            </button>
          </form>
        )}

        {/*  STEP 2: OTP verification  */}
        {step === "otp" && (
          <form onSubmit={handleVerify} className="auth-form">
            <div>
              {lbl("Enter the 6-digit OTP")}
              <input
                type="text" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456" className="input" maxLength={6} required
                style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: 10, fontWeight: 700 }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--text-dim)" }}>OTP expires in 10 minutes</p>
            </div>
            <button type="submit" disabled={loading || otp.length !== 6} className="btn btn-gradient full-width" style={{ padding: 13, fontSize: "1rem" }}>
              {loading ? "Verifying…" : <><CheckCircle size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Verify Email</>}
            </button>
            <button type="button" onClick={handleResend} disabled={loading} className="btn btn-secondary full-width" style={{ fontSize: "0.9rem" }}>
              Resend OTP
            </button>
            <button type="button" onClick={() => { setStep("form"); setOtp(""); setError(""); setSuccess(""); }}
              style={{ background: "none", border: 0, color: "var(--text-dim)", fontSize: "0.85rem", cursor: "pointer", textAlign: "center" }}>
              <ArrowLeft size={13} style={{ verticalAlign: "middle", marginRight: 4 }} /> Change email
            </button>
          </form>
        )}

        <p className="auth-footnote">Already have an account? <Link to="/login">Sign in</Link></p>
        <p className="auth-footnote" style={{ marginTop: 8 }}>
          <Link to="/" style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}><ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />Back to home</Link>
        </p>
      </section>
    </main>
  );
}

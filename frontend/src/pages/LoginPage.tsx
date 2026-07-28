import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Zap, ArrowLeft } from "lucide-react";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [emailError, setEmailError] = useState("");
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleEmailBlur = () => {
    if (email && !EMAIL_RE.test(email)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    if (!EMAIL_RE.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      if (!user) { setError("Login failed. Please try again."); return; }
      navigate(user.role === "admin" ? "/admin" : "/user", { replace: true });
    } catch (err: any) {
      if (err.response?.data?.needsVerification) {
        navigate(`/signup?verify=${encodeURIComponent(email)}`);
        return;
      }
      setError(
        err.response?.data?.msg ||
        (err.message === "Network Error"
          ? "Backend is unreachable. Is the server running?"
          : (err.message || "Invalid email or password."))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#4f46e5,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", margin: "0 auto 14px", boxShadow: "0 8px 24px rgba(79,70,229,0.4)" }}>
            <Zap size={24} color="#fff" fill="#fff" />
          </div>
          <h1 style={{ fontSize: "1.6rem", margin: "0 0 6px", color: "var(--text)", letterSpacing: "-0.025em" }}>Welcome back</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>Sign in to Campus Event Finder</p>
        </div>

        {error && <Alert type="error" message={error} />}

        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px" }}>
              Email address
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
              onBlur={handleEmailBlur}
              placeholder="you@example.com"
              className="input"
              required
              autoComplete="email"
              style={emailError ? { borderColor: "#ef4444", boxShadow: "0 0 0 3px rgba(239,68,68,0.15)" } : {}}
            />
            {emailError && (
              <p style={{ margin: "5px 0 0", fontSize: "0.8rem", color: "#ef4444" }}> {emailError}</p>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "6px" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              className="input"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !!emailError}
            className="btn btn-gradient full-width"
            style={{ marginTop: "4px", padding: "13px", fontSize: "1rem" }}
          >
            {loading ? "Signing in…" : <>Sign In <ArrowLeft size={14} style={{ verticalAlign: "middle", marginLeft: 4, transform: "rotate(180deg)" }} /></>}
          </button>
        </form>

        <p className="auth-footnote">
          Don't have an account? <Link to="/signup">Create one free</Link>
        </p>
        <p className="auth-footnote" style={{ marginTop: "8px" }}>
          <Link to="/" style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}><ArrowLeft size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />Back to home</Link>
        </p>
      </section>
    </main>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import Alert from '../components/Alert';
import { forgotPassword } from '../services/authService';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!EMAIL_RE.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailError('');
    setLoading(true);

    try {
      const res = await forgotPassword(email);
      setMessage(res.msg || 'If that account exists, a reset link has been emailed.');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } }; message?: string };
      setError(err.response?.data?.msg || err.message || 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg,#4f46e5,#8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              margin: '0 auto 14px',
              boxShadow: '0 8px 24px rgba(79,70,229,0.4)',
            }}
          >
            <Zap size={24} color="#fff" fill="#fff" />
          </div>
          <h1
            style={{
              fontSize: '1.6rem',
              margin: '0 0 6px',
              color: 'var(--text)',
              letterSpacing: '-0.025em',
            }}
          >
            Forgot Password
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Enter your email and we’ll send a reset link.
          </p>
        </div>

        {error && <Alert type="error" message={error} />}
        {message && <Alert type="success" message={message} />}

        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-2)',
                marginBottom: 6,
              }}
            >
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
              required
              autoComplete="email"
              onBlur={() =>
                setEmailError(
                  email && !EMAIL_RE.test(email) ? 'Please enter a valid email address' : ''
                )
              }
              style={
                emailError
                  ? { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' }
                  : {}
              }
            />
            {emailError && (
              <p style={{ margin: '5px 0 0', fontSize: '0.8rem', color: '#ef4444' }}>
                {emailError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !!emailError}
            className="btn btn-gradient full-width"
            style={{ marginTop: 4, padding: '13px', fontSize: '1rem' }}
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-footnote" style={{ marginTop: '12px' }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}

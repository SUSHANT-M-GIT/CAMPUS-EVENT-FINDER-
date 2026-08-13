import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import Alert from '../components/Alert';
import { resetPassword } from '../services/authService';

const PASSWORD_MIN_LENGTH = 6;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!token || !email) {
      setError('Reset link is invalid or missing.');
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword({ email, token, password });
      setMessage(res.msg || 'Password reset successfully. Redirecting to login…');
      setTimeout(() => navigate('/login'), 1800);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } }; message?: string };
      setError(err.response?.data?.msg || err.message || 'Unable to reset password.');
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
            Reset password
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Enter a new password for your account.
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
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
            />
          </div>

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
              Confirm password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              required
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-gradient full-width"
            style={{ marginTop: 4, padding: '13px', fontSize: '1rem' }}
          >
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="auth-footnote" style={{ marginTop: '12px' }}>
          <Link to="/login">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Alert from '../components/Alert';
import SocialAuthButtons from '../components/SocialAuthButtons';
import { useAuth } from '../context/AuthContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleEmailBlur = () => {
    if (email && !EMAIL_RE.test(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!EMAIL_RE.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (!user) {
        setError('Login failed. Please try again.');
        return;
      }
      navigate(user.role === 'admin' ? '/admin' : '/user', { replace: true });
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { needsVerification?: boolean; msg?: string } };
        message?: string;
      };
      if (err.response?.data?.needsVerification) {
        navigate(`/signup?verify=${encodeURIComponent(email)}`);
        return;
      }
      setError(
        err.response?.data?.msg ||
          (err.message === 'Network Error'
            ? 'Backend is unreachable. Is the server running?'
            : err.message || 'Invalid email or password.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
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
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Sign in to Campus Event Finder
          </p>
        </div>

        {error && <Alert type="error" message={error} />}

        <div style={{ margin: '18px 0 14px' }}>
          <SocialAuthButtons onError={(msg) => setError(msg)} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            margin: '18px 0',
            color: 'var(--text-dim)',
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          <span style={{ padding: '0 12px' }}>or sign in with email</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-2)',
                marginBottom: '6px',
              }}
            >
              Email address
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError('');
              }}
              onBlur={handleEmailBlur}
              placeholder="you@example.com"
              className="input"
              required
              autoComplete="email"
              style={
                emailError
                  ? { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' }
                  : {}
              }
            />
            {emailError && (
              <p style={{ margin: '5px 0 0', fontSize: '0.8rem', color: '#ef4444' }}>
                {' '}
                {emailError}
              </p>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                Password
              </label>
              <Link to="/forgot-password" style={{ color: '#6C63FF', fontSize: '0.8rem', fontWeight: 500, textDecoration: 'none' }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                required
                autoComplete="current-password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !!emailError}
            className="btn btn-gradient full-width"
            style={{ marginTop: '4px', padding: '13px', fontSize: '1rem' }}
          >
            {loading ? (
              'Signing in…'
            ) : (
              <>
                Sign In{' '}
                <ArrowLeft
                  size={14}
                  style={{ verticalAlign: 'middle', marginLeft: 4, transform: 'rotate(180deg)' }}
                />
              </>
            )}
          </button>
        </form>

        <p className="auth-footnote" style={{ marginTop: '16px' }}>
          Don't have an account? <Link to="/signup">Create one free</Link>
        </p>
        <p className="auth-footnote" style={{ marginTop: '8px' }}>
          <Link to="/" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            <ArrowLeft size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}

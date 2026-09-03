import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { CheckCircle, X, GraduationCap, Briefcase, User as UserIcon, Shield } from 'lucide-react';
import { googleAuth, microsoftAuth } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import Alert from './Alert';

// ── Singleton MSAL instance — created once, reused across renders ─────────────
// Keeping it outside the component prevents duplicate instantiation which is
// the root cause of the interaction_in_progress error.
let _msalInstance: import('@azure/msal-browser').PublicClientApplication | null = null;
let _msalInitialized = false;
let _msalInitPromise: Promise<void> | null = null;

async function getMsalInstance(clientId: string) {
  if (_msalInstance && _msalInitialized) return _msalInstance;

  // Only one init at a time even if called concurrently
  if (_msalInitPromise) {
    await _msalInitPromise;
    return _msalInstance!;
  }

  const { PublicClientApplication } = await import('@azure/msal-browser');
  const instance = new PublicClientApplication({
    auth: {
      clientId,
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });

  _msalInitPromise = instance.initialize().then(() => {
    _msalInstance = instance;
    _msalInitialized = true;
    _msalInitPromise = null;
  });

  await _msalInitPromise;
  return _msalInstance!;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type ProfileRole = 'student' | 'professional' | 'general' | 'admin';

interface SocialAuthButtonsProps {
  onError?: (msg: string) => void;
  onSuccess?: () => void;
}

export default function SocialAuthButtons({ onError, onSuccess }: SocialAuthButtonsProps) {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<'google' | 'microsoft' | null>(null);

  // Stored OAuth tokens for profile completion second-pass
  const [googleIdToken, setGoogleIdToken] = useState('');
  const [msTokens, setMsTokens] = useState<{ accessToken?: string; idToken?: string }>({});

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalError, setModalError] = useState('');

  const [userMeta, setUserMeta] = useState<{ email: string; name: string; provider: 'google' | 'microsoft' }>({
    email: '', name: '', provider: 'google',
  });

  const [role, setRole] = useState<ProfileRole>('student');
  const [collegeName, setCollegeName] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [company, setCompany] = useState('');
  const [designation, setDesignation] = useState('');
  const [phone, setPhone] = useState('');

  // Guard: prevent starting a second MSAL interaction while one is in progress
  const msalInteractionRef = useRef(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const isGoogleConfigured = Boolean(
    googleClientId &&
    googleClientId !== 'your_google_client_id_here.apps.googleusercontent.com' &&
    !googleClientId.includes('your_google_client_id_here')
  );

  // ── Navigate after successful auth ──────────────────────────────────────────
  const navigateAfterAuth = useCallback(
    (userRole: string) => {
      if (onSuccess) onSuccess();
      navigate(userRole === 'admin' ? '/admin' : '/user', { replace: true });
    },
    [navigate, onSuccess]
  );

  // ── GOOGLE ───────────────────────────────────────────────────────────────────
  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      if (!token) {
        if (onError) onError('Google did not return an access token.');
        setLoading(false);
        setActiveProvider(null);
        return;
      }
      setGoogleIdToken(token);
      try {
        const res = await googleAuth({ idToken: token });
        if (res.token) {
          const user = await loginWithToken(res.token);
          navigateAfterAuth(user?.role ?? '');
          return;
        }
        if (res.needsProfileCompletion) {
          setUserMeta({ email: res.googleEmail || '', name: res.googleName || 'User', provider: 'google' });
          setRole('student');
          setCollegeName(''); setCollegeId(''); setCompany(''); setDesignation(''); setPhone('');
          setModalError('');
          setShowProfileModal(true);
        }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { msg?: string } }; message?: string };
        if (onError) onError(e.response?.data?.msg || e.message || 'Google sign-in failed.');
      } finally {
        setLoading(false);
        setActiveProvider(null);
      }
    },
    onError: () => {
      setLoading(false);
      setActiveProvider(null);
      if (onError) onError('Google sign-in was cancelled or encountered an error.');
    },
  });

  const handleGoogleClick = () => {
    if (loading) return;
    if (!isGoogleConfigured) {
      if (onError) onError('Google OAuth is not configured. Set VITE_GOOGLE_CLIENT_ID in your environment.');
      return;
    }
    setLoading(true);
    setActiveProvider('google');
    try {
      triggerGoogleLogin();
    } catch {
      setLoading(false);
      setActiveProvider(null);
      if (onError) onError('Could not initialise Google Sign-In.');
    }
  };

  // ── MICROSOFT ────────────────────────────────────────────────────────────────
  const handleMicrosoftLogin = async () => {
    if (loading) return; // already doing something

    // Hard guard: never start a second popup while one is already open
    if (msalInteractionRef.current) {
      if (onError) onError('Microsoft sign-in is already in progress. Please wait.');
      return;
    }

    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
    if (!clientId || clientId === 'your_microsoft_client_id_here') {
      if (onError) onError('Microsoft OAuth is not configured. Set VITE_MICROSOFT_CLIENT_ID in your environment.');
      return;
    }

    setLoading(true);
    setActiveProvider('microsoft');
    msalInteractionRef.current = true;

    try {
      // Get the singleton — safe to call multiple times
      const instance = await getMsalInstance(clientId);

      // Clear any stale interaction state from previous timed-out/cancelled attempts
      await instance.handleRedirectPromise().catch(() => null);

      // Clear any in-progress interaction left in sessionStorage by a previous timeout
      try {
        const keys = Object.keys(sessionStorage);
        keys.forEach((k) => {
          if (k.includes('interaction.status') || k.includes('request.initiated')) {
            sessionStorage.removeItem(k);
          }
        });
      } catch { /* ignore */ }

      const loginResult = await instance.loginPopup({
        scopes: ['user.read', 'openid', 'profile', 'email'],
        prompt: 'select_account',
      });

      const { accessToken, idToken } = loginResult;
      setMsTokens({ accessToken, idToken });

      const res = await microsoftAuth({ accessToken, idToken });

      if (res.token) {
        const user = await loginWithToken(res.token);
        navigateAfterAuth(user?.role ?? '');
        return;
      }

      if (res.needsProfileCompletion) {
        setUserMeta({ email: res.msEmail || '', name: res.msName || 'User', provider: 'microsoft' });
        setRole('student');
        setCollegeName(''); setCollegeId(''); setCompany(''); setDesignation(''); setPhone('');
        setModalError('');
        setShowProfileModal(true);
      }
    } catch (err: unknown) {
      const e = err as { errorCode?: string; response?: { data?: { msg?: string } }; message?: string };

      // User closed the popup — not an error
      if (
        e.errorCode === 'user_cancelled' ||
        e.errorCode === 'popup_window_error' ||
        (e.message && e.message.includes('user_cancelled'))
      ) {
        // silent — user deliberately closed
      } else if (
        e.errorCode === 'timed_out' ||
        (e.message && e.message.includes('timed_out'))
      ) {
        // Popup timed out — clear stale MSAL state so next click works
        try {
          const keys = Object.keys(sessionStorage);
          keys.forEach((k) => {
            if (k.includes('msal') || k.includes('interaction') || k.includes('request')) {
              sessionStorage.removeItem(k);
            }
          });
        } catch { /* ignore */ }
        if (onError) onError('Microsoft sign-in timed out. Please try again.');
      } else if (
        e.errorCode === 'interaction_in_progress' ||
        (e.message && e.message.includes('interaction_in_progress'))
      ) {
        // This should not normally reach here because of the guard above,
        // but just in case of a race, surface a friendly message.
        if (onError) onError('Microsoft sign-in is already in progress. Please wait a moment and try again.');
      } else {
        const msg =
          e.response?.data?.msg ||
          (e.message === 'Network Error'
            ? 'Backend is unreachable. Please check if the server is running.'
            : e.message || 'Microsoft sign-in failed. Please try again.');
        if (onError) onError(msg);
      }
    } finally {
      msalInteractionRef.current = false;
      setLoading(false);
      setActiveProvider(null);
    }
  };

  // ── PROFILE COMPLETION SUBMIT ────────────────────────────────────────────────
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    // Validate per role
    if (role === 'student') {
      if (!collegeName.trim()) { setModalError('College / University name is required.'); return; }
      if (!collegeId.trim()) { setModalError('College ID / Roll number is required.'); return; }
    } else if (role === 'professional') {
      if (!designation.trim()) { setModalError('Your designation / role is required.'); return; }
    } else if (role === 'admin') {
      if (!collegeName.trim()) { setModalError('College / Organisation name is required.'); return; }
      if (!phone.trim()) { setModalError('Phone number is required for event organisers.'); return; }
    }
    // 'general' needs no extra fields

    setLoading(true);
    try {
      const payload = {
        role,
        collegeName: (role === 'student' || role === 'admin') ? collegeName.trim() : '',
        collegeId: role === 'student' ? collegeId.trim() : '',
        company: role === 'professional' ? company.trim() : '',
        designation: role === 'professional' ? designation.trim() : (role === 'admin' ? (designation.trim() || 'Event Organizer') : ''),
        phone: role === 'admin' ? phone.trim() : '',
      };

      let res;
      if (userMeta.provider === 'google') {
        res = await googleAuth({ idToken: googleIdToken, ...payload });
      } else {
        res = await microsoftAuth({ accessToken: msTokens.accessToken, idToken: msTokens.idToken, ...payload });
      }

      if (res.pendingApproval) {
        setShowProfileModal(false);
        alert(res.msg || 'Your organiser account has been created and is waiting for approval.');
        navigate('/login', { replace: true });
        return;
      }

      if (res.token) {
        const user = await loginWithToken(res.token);
        setShowProfileModal(false);
        navigateAfterAuth(user?.role ?? '');
      } else {
        setModalError(res.msg || 'Unable to complete sign-up. Please try again.');
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { msg?: string } }; message?: string };
      setModalError(e.response?.data?.msg || e.message || 'Failed to complete profile registration.');
    } finally {
      setLoading(false);
    }
  };

  // ── Role button helper ───────────────────────────────────────────────────────
  const roleBtn = (value: ProfileRole, icon: React.ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      style={{
        padding: '10px 6px',
        borderRadius: '8px',
        border: role === value ? '2px solid #6366f1' : '1px solid var(--border)',
        backgroundColor: role === value ? 'rgba(99,102,241,0.12)' : 'var(--card-bg)',
        color: role === value ? '#6366f1' : 'var(--text-2)',
        fontWeight: 600,
        fontSize: '0.78rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        textAlign: 'center',
        lineHeight: 1.3,
      }}
    >
      {icon}
      {label}
    </button>
  );

  const btnBase: React.CSSProperties = {
    width: '100%',
    height: '40px',
    borderRadius: '4px',
    backgroundColor: '#ffffff',
    border: '1px solid #dadce0',
    color: '#3c4043',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: 'Roboto, arial, sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    transition: 'background-color 0.2s, box-shadow 0.2s',
    boxShadow: '0 1px 2px rgba(60,64,67,0.1)',
    padding: '0 12px',
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {/* ── Google button ── */}
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={loading}
          style={{
            ...btnBase,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading && activeProvider === 'google' ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(60,64,67,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(60,64,67,0.1)'; }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          <span>{loading && activeProvider === 'google' ? 'Signing in…' : 'Continue with Google'}</span>
        </button>

        {/* ── Microsoft button ── */}
        <button
          type="button"
          onClick={handleMicrosoftLogin}
          disabled={loading}
          style={{
            ...btnBase,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading && activeProvider === 'microsoft' ? 0.7 : 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(60,64,67,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(60,64,67,0.1)'; }}
        >
          <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          <span>{loading && activeProvider === 'microsoft' ? 'Signing in…' : 'Continue with Microsoft'}</span>
        </button>
      </div>

      {/* ── Profile Completion Modal ─────────────────────────────────────────── */}
      {showProfileModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl, 18px)', padding: '28px', maxWidth: '500px',
              width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              position: 'relative', maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6 }}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: '#fff' }}>
                <CheckCircle size={22} />
              </div>
              <h2 style={{ fontSize: '1.25rem', margin: '0 0 4px', color: 'var(--text)' }}>Complete Your Profile</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Welcome, <strong>{userMeta.name}</strong> ({userMeta.email})
              </p>
            </div>

            {modalError && <Alert type="error" message={modalError} />}

            <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Role selector — 4 options */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                  I am registering as:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {roleBtn('student',      <GraduationCap size={18} />, 'Student')}
                  {roleBtn('professional', <Briefcase size={18} />,     'Working Professional')}
                  {roleBtn('general',      <UserIcon size={18} />,      'General / Individual')}
                  {roleBtn('admin',        <Shield size={18} />,        'Admin / Organizer')}
                </div>
                {role === 'general' && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Not a student or professional? Just want to explore campus events — this is for you.
                  </p>
                )}
                {role === 'admin' && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#f59e0b' }}>
                    ⚠️ Organiser access requires approval by the platform owner. You won't have organiser privileges until approved.
                  </p>
                )}
              </div>

              {/* Student fields */}
              {role === 'student' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                      College / University Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input type="text" className="input" value={collegeName} onChange={e => setCollegeName(e.target.value)} placeholder="e.g. Reva University" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                      College ID / Roll Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input type="text" className="input" value={collegeId} onChange={e => setCollegeId(e.target.value)} placeholder="e.g. R23EJ125" required />
                  </div>
                </>
              )}

              {/* Working Professional fields */}
              {role === 'professional' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                      Your Role / Designation <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input type="text" className="input" value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Software Engineer, Designer" required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                      Company / Organisation <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input type="text" className="input" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google, Freelancer" />
                  </div>
                </>
              )}

              {/* General / Individual — no extra fields required */}
              {role === 'general' && (
                <div style={{ padding: '12px', borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                  No additional information required. Click <strong>Continue</strong> to create your account.
                </div>
              )}

              {/* Admin / Organizer fields */}
              {role === 'admin' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                      College / Organisation Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input type="text" className="input" value={collegeName} onChange={e => setCollegeName(e.target.value)} placeholder="e.g. Reva University / Tech Club" required />
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>Your event organising club or institution name</p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                      Phone / Contact Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input type="tel" className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" required />
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>Required for organiser verification</p>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                      Your Designation <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <input type="text" className="input" value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Club President, Event Lead" />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-gradient full-width"
                style={{ marginTop: 8, padding: 12, fontSize: '0.95rem' }}
              >
                {loading ? 'Creating Account…' : 'Continue to Dashboard'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

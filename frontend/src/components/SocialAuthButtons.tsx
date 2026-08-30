import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { PublicClientApplication, type Configuration } from '@azure/msal-browser';
import { CheckCircle, X, GraduationCap, Briefcase, Shield } from 'lucide-react';
import { googleAuth, microsoftAuth } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import Alert from './Alert';

interface SocialAuthButtonsProps {
  onError?: (msg: string) => void;
  onSuccess?: () => void;
}

export default function SocialAuthButtons({ onError, onSuccess }: SocialAuthButtonsProps) {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<'google' | 'microsoft' | null>(null);

  // Stored OAuth credentials for completing profile
  const [googleIdToken, setGoogleIdToken] = useState<string>('');
  const [msTokens, setMsTokens] = useState<{ accessToken?: string; idToken?: string }>({});

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalError, setModalError] = useState('');

  // Profile completion form state for new OAuth users
  const [userMeta, setUserMeta] = useState<{
    email: string;
    name: string;
    provider: 'google' | 'microsoft';
  }>({ email: '', name: '', provider: 'google' });

  const [role, setRole] = useState<'student' | 'professional' | 'admin'>('student');
  const [collegeName, setCollegeName] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [company, setCompany] = useState('');
  const [designation, setDesignation] = useState('');

  // MSAL client instance reference
  const msalInstanceRef = useRef<PublicClientApplication | null>(null);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const isGoogleConfigured = Boolean(
    googleClientId &&
      googleClientId !== 'your_google_client_id_here.apps.googleusercontent.com' &&
      !googleClientId.includes('your_google_client_id_here')
  );

  // ── GOOGLE SIGN-IN HANDLER VIA USE_GOOGLE_LOGIN ─────────────────────────────
  const triggerGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      if (!token) {
        if (onError) onError('Google did not return an access token.');
        setLoading(false);
        return;
      }

      setGoogleIdToken(token);
      setActiveProvider('google');
      setLoading(true);

      try {
        const res = await googleAuth({ idToken: token });

        if (res.token) {
          const user = await loginWithToken(res.token);
          if (onSuccess) onSuccess();
          navigate(user?.role === 'admin' ? '/admin' : '/user', { replace: true });
          return;
        }

        if (res.needsProfileCompletion) {
          setUserMeta({
            email: res.googleEmail || '',
            name: res.googleName || 'User',
            provider: 'google',
          });
          setRole(res.role === 'professional' ? 'professional' : 'student');
          setShowProfileModal(true);
        }
      } catch (error: unknown) {
        const err = error as {
          response?: { data?: { msg?: string } };
          message?: string;
        };
        const errorMsg =
          err.response?.data?.msg ||
          (err.message === 'Network Error'
            ? 'Backend is unreachable. Please check if the server is running.'
            : err.message || 'Google sign-in failed. Please try again.');
        if (onError) onError(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setLoading(false);
      if (onError) onError('Google Sign-In was cancelled or encountered an error.');
    },
  });

  const handleGoogleClick = () => {
    if (!isGoogleConfigured) {
      if (onError) {
        onError(
          'Google OAuth Client ID is not configured yet. Please set VITE_GOOGLE_CLIENT_ID in your environment variables.'
        );
      }
      return;
    }
    setLoading(true);
    setActiveProvider('google');
    try {
      triggerGoogleLogin();
    } catch {
      setLoading(false);
      if (onError) onError('Could not initialize Google Sign-In.');
    }
  };

  // ── MICROSOFT SIGN-IN HANDLER ────────────────────────────────────────────────
  const handleMicrosoftLogin = async () => {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
    if (!clientId || clientId === 'your_microsoft_client_id_here') {
      if (onError) {
        onError('Microsoft OAuth is not configured yet. Please set VITE_MICROSOFT_CLIENT_ID in your environment.');
      }
      return;
    }

    setLoading(true);
    setActiveProvider('microsoft');

    try {
      if (!msalInstanceRef.current) {
        const msalConfig: Configuration = {
          auth: {
            clientId,
            authority: 'https://login.microsoftonline.com/common', // Supports both personal & institutional Microsoft 365 accounts
            redirectUri: window.location.origin,
          },
          cache: {
            cacheLocation: 'sessionStorage',
          },
        };
        const msalInstance = new PublicClientApplication(msalConfig);
        await msalInstance.initialize();
        msalInstanceRef.current = msalInstance;
      }

      const instance = msalInstanceRef.current;
      if (!instance) {
        throw new Error('Could not initialize Microsoft authentication client.');
      }

      const loginResult = await instance.loginPopup({
        scopes: ['user.read', 'openid', 'profile', 'email'],
        prompt: 'select_account',
      });

      const accessToken = loginResult.accessToken;
      const idToken = loginResult.idToken;

      setMsTokens({ accessToken, idToken });

      const res = await microsoftAuth({ accessToken, idToken });

      if (res.token) {
        const user = await loginWithToken(res.token);
        if (onSuccess) onSuccess();
        navigate(user?.role === 'admin' ? '/admin' : '/user', { replace: true });
        return;
      }

      if (res.needsProfileCompletion) {
        setUserMeta({
          email: res.msEmail || '',
          name: res.msName || 'User',
          provider: 'microsoft',
        });
        setRole(res.role === 'professional' ? 'professional' : 'student');
        setShowProfileModal(true);
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { msg?: string } };
        message?: string;
        errorCode?: string;
      };
      if (err.errorCode === 'user_cancelled') {
        // User closed popup
        return;
      }
      const errorMsg =
        err.response?.data?.msg ||
        (err.message === 'Network Error'
          ? 'Backend is unreachable. Please check if the server is running.'
          : err.message || 'Microsoft sign-in failed. Please try again.');
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ── SUBMIT PROFILE COMPLETION ────────────────────────────────────────────────
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (role === 'student') {
      if (!collegeName.trim()) {
        setModalError('College / University name is required for students.');
        return;
      }
      if (!collegeId.trim()) {
        setModalError('College ID / Roll number is required for students.');
        return;
      }
    } else if (role === 'professional') {
      if (!designation.trim()) {
        setModalError('Your designation / role is required.');
        return;
      }
    } else if (role === 'admin') {
      if (!collegeName.trim()) {
        setModalError('College / Organisation name is required for event organizers.');
        return;
      }
    }

    setLoading(true);
    try {
      let res;
      if (userMeta.provider === 'google') {
        res = await googleAuth({
          idToken: googleIdToken,
          role,
          collegeName: role === 'student' || role === 'admin' ? collegeName.trim() : '',
          collegeId: role === 'student' ? collegeId.trim() : '',
          company: role === 'professional' ? company.trim() : '',
          designation: role === 'professional' ? designation.trim() : (role === 'admin' ? (designation.trim() || 'Event Organizer') : ''),
        });
      } else {
        res = await microsoftAuth({
          accessToken: msTokens.accessToken,
          idToken: msTokens.idToken,
          role,
          collegeName: role === 'student' || role === 'admin' ? collegeName.trim() : '',
          collegeId: role === 'student' ? collegeId.trim() : '',
          company: role === 'professional' ? company.trim() : '',
          designation: role === 'professional' ? designation.trim() : (role === 'admin' ? (designation.trim() || 'Event Organizer') : ''),
        });
      }

      if (res.token) {
        const user = await loginWithToken(res.token);
        setShowProfileModal(false);
        if (onSuccess) onSuccess();
        navigate(user?.role === 'admin' ? '/admin' : '/user', { replace: true });
      } else {
        setModalError(res.msg || 'Unable to complete sign up. Please try again.');
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { msg?: string } };
        message?: string;
      };
      setModalError(
        err.response?.data?.msg || err.message || 'Failed to complete profile registration.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={loading}
          style={{
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
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading && activeProvider === 'google' ? 0.7 : 1,
            transition: 'background-color 0.2s, box-shadow 0.2s',
            boxShadow: '0 1px 2px rgba(60,64,67,0.1)',
            padding: '0 12px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(60,64,67,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(60,64,67,0.1)';
          }}
        >
          {/* Official Google G Logo SVG */}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.039l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Microsoft Sign In Button */}
        <button
          type="button"
          onClick={handleMicrosoftLogin}
          disabled={loading}
          style={{
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
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading && activeProvider === 'microsoft' ? 0.7 : 1,
            transition: 'background-color 0.2s, box-shadow 0.2s',
            boxShadow: '0 1px 2px rgba(60,64,67,0.1)',
            padding: '0 12px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8f9fa';
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(60,64,67,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.boxShadow = '0 1px 2px rgba(60,64,67,0.1)';
          }}
        >
          {/* Microsoft 4-color Logo SVG */}
          <svg width="18" height="18" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          <span>Continue with Microsoft</span>
        </button>
      </div>

      {/* Profile Completion Modal for First-time OAuth Users */}
      {showProfileModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-xl, 18px)',
              padding: '28px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              position: 'relative',
              animation: 'fadeIn 0.2s ease-out',
            }}
          >
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg,#4f46e5,#8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: '#fff',
                }}
              >
                <CheckCircle size={22} />
              </div>
              <h2 style={{ fontSize: '1.25rem', margin: '0 0 4px', color: 'var(--text)' }}>
                Complete Your Profile
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Welcome, <strong>{userMeta.name}</strong> ({userMeta.email})
              </p>
            </div>

            {modalError && <Alert type="error" message={modalError} />}

            <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    marginBottom: 6,
                  }}
                >
                  I am registering as:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '8px',
                      border: role === 'student' ? '2px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: role === 'student' ? 'rgba(99, 102, 241, 0.12)' : 'var(--card-bg)',
                      color: role === 'student' ? '#6366f1' : 'var(--text-2)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <GraduationCap size={18} /> Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('professional')}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '8px',
                      border: role === 'professional' ? '2px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: role === 'professional' ? 'rgba(99, 102, 241, 0.12)' : 'var(--card-bg)',
                      color: role === 'professional' ? '#6366f1' : 'var(--text-2)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Briefcase size={18} /> Professional
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '8px',
                      border: role === 'admin' ? '2px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: role === 'admin' ? 'rgba(99, 102, 241, 0.12)' : 'var(--card-bg)',
                      color: role === 'admin' ? '#6366f1' : 'var(--text-2)',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Shield size={18} /> Organizer / Admin
                  </button>
                </div>
              </div>

              {role === 'student' && (
                <>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-2)',
                        marginBottom: 6,
                      }}
                    >
                      College / University Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="e.g. Reva University"
                      required
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-2)',
                        marginBottom: 6,
                      }}
                    >
                      College ID / Roll Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={collegeId}
                      onChange={(e) => setCollegeId(e.target.value)}
                      placeholder="e.g. R23EJ125"
                      required
                    />
                  </div>
                </>
              )}

              {role === 'professional' && (
                <>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-2)',
                        marginBottom: 6,
                      }}
                    >
                      Your Role / Designation <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Software Engineer, Designer"
                      required
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-2)',
                        marginBottom: 6,
                      }}
                    >
                      Company / Organisation (optional)
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Google, Freelancer"
                    />
                  </div>
                </>
              )}

              {role === 'admin' && (
                <>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-2)',
                        marginBottom: 6,
                      }}
                    >
                      College / Organisation Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      placeholder="e.g. Reva University / Tech Club"
                      required
                    />
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Used as your event organizing club / institution name
                    </p>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-2)',
                        marginBottom: 6,
                      }}
                    >
                      Your Designation / Role (optional)
                    </label>
                    <input
                      type="text"
                      className="input"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Event Lead, Club President"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-gradient full-width"
                style={{ marginTop: '8px', padding: '12px', fontSize: '0.95rem' }}
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

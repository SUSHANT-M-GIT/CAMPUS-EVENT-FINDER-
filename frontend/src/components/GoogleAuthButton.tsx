import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { CheckCircle, X, GraduationCap, Briefcase } from 'lucide-react';
import { googleAuth } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import Alert from './Alert';

interface GoogleAuthButtonProps {
  onError?: (msg: string) => void;
  onSuccess?: () => void;
}

export default function GoogleAuthButton({ onError, onSuccess }: GoogleAuthButtonProps) {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [googleIdToken, setGoogleIdToken] = useState<string>('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [modalError, setModalError] = useState('');

  // Profile completion form state for new users
  const [googleUserMeta, setGoogleUserMeta] = useState<{
    email: string;
    name: string;
  }>({ email: '', name: '' });

  const [role, setRole] = useState<'student' | 'professional'>('student');
  const [collegeName, setCollegeName] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [company, setCompany] = useState('');
  const [designation, setDesignation] = useState('');

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const idToken = credentialResponse.credential;
    if (!idToken) {
      if (onError) onError('Google did not return a valid authentication credential.');
      return;
    }

    setGoogleIdToken(idToken);
    setLoading(true);

    try {
      const res = await googleAuth({ idToken });

      if (res.token) {
        // Existing user or successfully authenticated
        const user = await loginWithToken(res.token);
        if (onSuccess) onSuccess();
        navigate(user?.role === 'admin' ? '/admin' : '/user', { replace: true });
        return;
      }

      if (res.needsProfileCompletion) {
        // New user needs to choose role and supply student/professional info
        setGoogleUserMeta({
          email: res.googleEmail || '',
          name: res.googleName || 'User',
        });
        if (res.role === 'professional') {
          setRole('professional');
        } else {
          setRole('student');
        }
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
          ? 'Backend is unreachable. Please verify the server is running.'
          : err.message || 'Google sign-in failed. Please try again.');
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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
    }

    setLoading(true);
    try {
      const res = await googleAuth({
        idToken: googleIdToken,
        role,
        collegeName: role === 'student' ? collegeName.trim() : '',
        collegeId: role === 'student' ? collegeId.trim() : '',
        company: role === 'professional' ? company.trim() : '',
        designation: role === 'professional' ? designation.trim() : '',
      });

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
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          opacity: loading ? 0.7 : 1,
          pointerEvents: loading ? 'none' : 'auto',
          marginTop: 2,
          marginBottom: 2,
        }}
      >
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => {
            if (onError) onError('Google Sign-In was cancelled or failed.');
          }}
          theme="outline"
          size="large"
          text="continue_with"
          shape="rectangular"
          width="100%"
        />
      </div>

      {/* Profile Completion Modal for First-time Google Users */}
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
              maxWidth: '460px',
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
                Welcome, <strong>{googleUserMeta.name}</strong> ({googleUserMeta.email})
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: role === 'student' ? '2px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: role === 'student' ? 'rgba(99, 102, 241, 0.12)' : 'var(--card-bg)',
                      color: role === 'student' ? '#6366f1' : 'var(--text-2)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <GraduationCap size={16} /> Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('professional')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: role === 'professional' ? '2px solid #6366f1' : '1px solid var(--border)',
                      backgroundColor: role === 'professional' ? 'rgba(99, 102, 241, 0.12)' : 'var(--card-bg)',
                      color: role === 'professional' ? '#6366f1' : 'var(--text-2)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Briefcase size={16} /> Professional
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

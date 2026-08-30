import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Briefcase,
  Shield,
  Lock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import AppNavbar from '../components/AppNavbar';
import { changePassword } from '../services/authService';

export default function UserProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  if (!user) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid var(--border)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading your profile…</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitial = (name?: string, collegeName?: string) => {
    if (name) return name.charAt(0).toUpperCase();
    if (collegeName) return collegeName.charAt(0).toUpperCase();
    return 'U';
  };

  const copyUserId = () => {
    if (user.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return {
          bg: 'rgba(34, 197, 94, 0.12)',
          text: '#22c55e',
          border: 'rgba(34, 197, 94, 0.3)',
          label: 'Admin / Organizer',
          icon: <Shield size={14} />,
        };
      case 'professional':
        return {
          bg: 'rgba(59, 130, 246, 0.12)',
          text: '#3b82f6',
          border: 'rgba(59, 130, 246, 0.3)',
          label: 'Working Professional',
          icon: <Briefcase size={14} />,
        };
      case 'student':
      default:
        return {
          bg: 'rgba(99, 102, 241, 0.12)',
          text: '#6366f1',
          border: 'rgba(99, 102, 241, 0.3)',
          label: 'Student',
          icon: <BookOpen size={14} />,
        };
    }
  };

  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation password do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordMessage(response.msg || 'Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      setPasswordError(err.response?.data?.msg || 'Unable to update password. Please check your current password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const roleBadge = getRoleBadge(user.role);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <AppNavbar
        links={[
          { label: 'Dashboard', to: user.role === 'admin' ? '/admin' : '/user' },
          { label: 'Profile', to: '/profile' },
        ]}
        userName={user.name}
        userInitial={getInitial(user.name, user.collegeName)}
      />

      <main className="app-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 16px 64px' }}>
        {/* Top Breadcrumb & Header */}
        <div style={{ marginBottom: '28px' }}>
          <button
            onClick={() => navigate(user.role === 'admin' ? '/admin' : '/user')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              marginBottom: '12px',
              padding: 0,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#6C63FF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Account Profile
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage your personal credentials, identity, and security preferences
          </p>
        </div>

        {/* Hero User Banner Card */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-xl, 18px)',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: 'var(--shadow-card)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6C63FF, #A855F7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.8rem',
                fontWeight: 800,
                color: '#fff',
                flexShrink: 0,
                boxShadow: '0 8px 24px rgba(108, 99, 255, 0.35)',
              }}
            >
              {getInitial(user.name, user.collegeName)}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)' }}>
                  {user.name || 'User'}
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    backgroundColor: roleBadge.bg,
                    color: roleBadge.text,
                    border: `1px solid ${roleBadge.border}`,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {roleBadge.icon}
                  {roleBadge.label}
                </span>
                {user.isVerified && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '999px',
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      color: '#22c55e',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    <CheckCircle2 size={13} />
                    Verified
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {user.email}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                e.currentTarget.style.color = '#ef4444';
              }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {/* PERSONAL & IDENTITY DETAILS */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg, 14px)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--card-bg)',
              }}
            >
              <UserIcon size={18} color="#6C63FF" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                Personal Information
              </h3>
            </div>

            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Full Name
                </label>
                <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                  {user.name || '—'}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Email Address
                </label>
                <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                  {user.email || '—'}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Account Status
                </label>
                <div style={{ margin: '4px 0 0' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: user.accountStatus === 'active' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      color: user.accountStatus === 'active' ? '#22c55e' : '#ef4444',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {user.accountStatus || 'Active'}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  User ID
                </label>
                <div style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code style={{ fontSize: '0.8rem', backgroundColor: 'var(--card-bg)', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    {user.id || '—'}
                  </code>
                  <button
                    type="button"
                    onClick={copyUserId}
                    title="Copy User ID"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedId ? '#22c55e' : 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    {copiedId ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ACADEMIC OR PROFESSIONAL INFORMATION */}
          {user.role === 'student' && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg, 14px)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'var(--card-bg)',
                }}
              >
                <BookOpen size={18} color="#6366f1" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                  Academic Information
                </h3>
              </div>

              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    College / University
                  </label>
                  <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                    {user.collegeName || '—'}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Student ID / Roll Number
                  </label>
                  <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                    {user.collegeId || '—'}
                  </div>
                </div>

                {user.department && (
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Department
                    </label>
                    <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                      {user.department}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {user.role === 'professional' && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg, 14px)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'var(--card-bg)',
                }}
              >
                <Briefcase size={18} color="#3b82f6" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                  Professional Details
                </h3>
              </div>

              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Job Title / Designation
                  </label>
                  <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                    {user.designation || '—'}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Company / Organisation
                  </label>
                  <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                    {user.company || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {user.role === 'admin' && (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg, 14px)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: 'var(--card-bg)',
                }}
              >
                <Shield size={18} color="#22c55e" />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                  Admin / Organization Details
                </h3>
              </div>

              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Club / Organization
                  </label>
                  <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                    {user.clubName || user.collegeName || '—'}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Designation
                  </label>
                  <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                    {user.designation || 'Event Organizer'}
                  </div>
                </div>

                {user.officialEmail && (
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Official Email
                    </label>
                    <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                      {user.officialEmail}
                    </div>
                  </div>
                )}

                {user.instagramHandle && (
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Instagram Handle
                    </label>
                    <div style={{ margin: '4px 0 0', fontSize: '0.95rem', fontWeight: 500, color: 'var(--text)' }}>
                      @{user.instagramHandle}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SECURITY & PASSWORD UPDATE */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-lg, 14px)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'var(--card-bg)',
              }}
            >
              <Lock size={18} color="#14b8a6" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
                Security & Password
              </h3>
            </div>

            <div style={{ padding: '20px' }}>
              <form onSubmit={handlePasswordChange} style={{ display: 'grid', gap: '16px', maxWidth: '500px' }}>
                {passwordError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#ef4444',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordMessage && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      color: '#22c55e',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>{passwordMessage}</span>
                  </div>
                )}

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-2)',
                      marginBottom: '6px',
                    }}
                  >
                    Current Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Enter your current password"
                      className="input"
                      required
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
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
                      }}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-2)',
                      marginBottom: '6px',
                    }}
                  >
                    New Password (Min. 6 characters)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                      className="input"
                      required
                      minLength={6}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
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
                      }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: 'var(--text-2)',
                      marginBottom: '6px',
                    }}
                  >
                    Confirm New Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                      className="input"
                      required
                      minLength={6}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                      }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingPassword}
                  className="btn btn-gradient"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '11px 22px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    marginTop: '4px',
                  }}
                >
                  {savingPassword ? 'Updating Password…' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

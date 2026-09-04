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
  Pencil,
  X,
  Mail,
  Phone,
  Hash,
} from 'lucide-react';
import AppNavbar from '../components/AppNavbar';
import { changePassword } from '../services/authService';

// ── Tiny helpers ──────────────────────────────────────────────────────────────

/** One labelled info field */
function InfoField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: '0.92rem', fontWeight: 500, color: 'var(--text)', fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all' }}>
        {value}
      </p>
    </div>
  );
}

/** Section card wrapper */
function SectionCard({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: accent }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
      </div>
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UserProfilePage() {
  const { user, logout, updateUserName } = useAuth();
  const navigate = useNavigate();

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState({ current: false, next: false, confirm: false });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [copiedId, setCopiedId] = useState(false);

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
          Loading your profile…
        </div>
      </div>
    );
  }

  const getInitial = () => (user.name || user.collegeName || 'U').charAt(0).toUpperCase();

  const copyUserId = () => {
    if (user.id) { navigator.clipboard.writeText(user.id); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
  };

  const roleBadge = (() => {
    switch (user.role) {
      case 'admin': return { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.28)', label: 'Admin / Organizer', icon: <Shield size={13} /> };
      case 'professional': return { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6', border: 'rgba(59,130,246,0.28)', label: 'Working Professional', icon: <Briefcase size={13} /> };
      default: return { bg: 'rgba(99,102,241,0.12)', text: '#6366f1', border: 'rgba(99,102,241,0.28)', label: 'Student', icon: <BookOpen size={13} /> };
    }
  })();

  // ── Name edit ───────────────────────────────────────────────────────────────
  const openNameEdit = () => { setNameInput(user.name || ''); setNameError(''); setNameSuccess(''); setEditingName(true); };
  const cancelNameEdit = () => { setEditingName(false); setNameError(''); setNameSuccess(''); };

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) { setNameError('Name cannot be empty.'); return; }
    if (trimmed.length < 2) { setNameError('Name must be at least 2 characters.'); return; }
    if (trimmed.length > 80) { setNameError('Name cannot exceed 80 characters.'); return; }
    if (trimmed === user.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      await updateUserName(trimmed);
      setNameSuccess('Name updated!');
      setEditingName(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { msg?: string } }; message?: string };
      setNameError(e.response?.data?.msg || e.message || 'Failed to update name.');
    } finally { setSavingName(false); }
  };

  // ── Password ────────────────────────────────────────────────────────────────
  const handlePasswordChange = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    setPasswordError(''); setPasswordMessage('');
    if (passwordForm.newPassword.length < 6) { setPasswordError('New password must be at least 6 characters.'); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setPasswordError('Passwords do not match.'); return; }
    setSavingPassword(true);
    try {
      const res = await changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordMessage(res.msg || 'Password updated!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { msg?: string } } };
      setPasswordError(e.response?.data?.msg || 'Could not update password.');
    } finally { setSavingPassword(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <AppNavbar
        links={[
          { label: 'Dashboard', to: user.role === 'admin' ? '/admin' : '/user' },
          { label: 'Profile', to: '/profile' },
        ]}
        userName={user.name}
        userInitial={getInitial()}
      />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 16px 72px' }}>

        {/* Back + heading */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => navigate(user.role === 'admin' ? '/admin' : '/user')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500, padding: 0, marginBottom: 10 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#6366f1')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <ArrowLeft size={15} /> Back to Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Account Profile</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            View and manage your account details
          </p>
        </div>

        {/* ── Avatar / hero card ──────────────────────────────────────────── */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* Avatar */}
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#6C63FF,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 4px 16px rgba(108,99,255,0.3)' }}>
              {getInitial()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)' }}>{user.name || 'User'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: roleBadge.bg, color: roleBadge.text, border: `1px solid ${roleBadge.border}`, fontSize: '0.73rem', fontWeight: 700 }}>
                  {roleBadge.icon} {roleBadge.label}
                </span>
                {user.isVerified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 999, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', fontSize: '0.72rem', fontWeight: 700 }}>
                    <CheckCircle2 size={12} /> Verified
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <Mail size={13} />
                <span>{user.email}</span>
              </div>
            </div>
          </div>

          {/* Sign out */}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#ef4444', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.18s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.07)'; e.currentTarget.style.color = '#ef4444'; }}
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Personal Information ─────────────────────────────────────── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {/* Section header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserIcon size={17} color="#6C63FF" />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>Personal Information</h3>
              </div>
              {!editingName && (
                <button
                  type="button"
                  onClick={openNameEdit}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}
                >
                  <Pencil size={12} /> Edit Name
                </button>
              )}
            </div>

            <div style={{ padding: '18px 20px' }}>
              {/* Name success */}
              {nameSuccess && !editingName && (
                <div style={{ marginBottom: 14, padding: '9px 13px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.28)', color: '#22c55e', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <CheckCircle2 size={15} /> {nameSuccess}
                </div>
              )}

              {/* Inline name edit */}
              {editingName && (
                <form onSubmit={handleNameSave} style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>New Name</label>
                  {nameError && (
                    <div style={{ marginBottom: 8, padding: '7px 11px', borderRadius: 7, background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.28)', color: '#ef4444', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertCircle size={13} /> {nameError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="input"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      placeholder="Your full name"
                      maxLength={80}
                      autoFocus
                      style={{ flex: '1 1 200px', minWidth: 0 }}
                    />
                    <button type="submit" disabled={savingName} className="btn btn-gradient" style={{ padding: '9px 18px', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {savingName ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelNameEdit} disabled={savingName} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '9px 13px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Fields grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <InfoField label="Full Name" value={user.name} />
                <InfoField label="Email Address" value={user.email} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Account Status</p>
                  <div style={{ marginTop: 4 }}>
                    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 6, background: user.accountStatus === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: user.accountStatus === 'active' ? '#22c55e' : '#ef4444', fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>
                      {user.accountStatus || 'Active'}
                    </span>
                  </div>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>User ID</p>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <code style={{ fontSize: '0.78rem', background: 'var(--card-bg)', padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)', color: 'var(--text-2)', wordBreak: 'break-all' }}>
                      {user.id || '—'}
                    </code>
                    <button type="button" onClick={copyUserId} title="Copy ID" style={{ background: 'none', border: 'none', color: copiedId ? '#22c55e' : 'var(--text-muted)', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                      {copiedId ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Student ──────────────────────────────────────────────────── */}
          {user.role === 'student' && (
            <SectionCard icon={<BookOpen size={17} />} title="Academic Information" accent="#6366f1">
              <InfoField label="College / University" value={user.collegeName} />
              <InfoField label="Student ID / Roll Number" value={user.collegeId} />
              {user.department && <InfoField label="Department" value={user.department} />}
              {user.phone && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phone</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.92rem', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Phone size={13} color="var(--text-muted)" /> {user.phone}
                  </p>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Professional ─────────────────────────────────────────────── */}
          {user.role === 'professional' && (
            <SectionCard icon={<Briefcase size={17} />} title="Professional Details" accent="#3b82f6">
              <InfoField label="Job Title / Designation" value={user.designation} />
              <InfoField label="Company / Organisation" value={user.company || '—'} />
              {user.phone && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phone</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.92rem', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Phone size={13} color="var(--text-muted)" /> {user.phone}
                  </p>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Admin ────────────────────────────────────────────────────── */}
          {user.role === 'admin' && (
            <SectionCard icon={<Shield size={17} />} title="Organizer Details" accent="#22c55e">
              <InfoField label="Club / Organization" value={user.clubName || user.collegeName} />
              <InfoField label="Designation" value={user.designation || 'Event Organizer'} />
              {user.officialEmail && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Official Email</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.92rem', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Mail size={13} color="var(--text-muted)" /> {user.officialEmail}
                  </p>
                </div>
              )}
              {user.instagramHandle && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Instagram</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.92rem', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Hash size={13} color="var(--text-muted)" /> {user.instagramHandle}
                  </p>
                </div>
              )}
              {user.phone && (
                <div>
                  <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Phone</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.92rem', fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Phone size={13} color="var(--text-muted)" /> {user.phone}
                  </p>
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Security ─────────────────────────────────────────────────── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Lock size={17} color="#14b8a6" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>Security & Password</h3>
            </div>

            <div style={{ padding: '20px' }}>
              <form onSubmit={handlePasswordChange} style={{ display: 'grid', gap: 14, maxWidth: 480 }}>
                {passwordError && (
                  <div style={{ padding: '9px 13px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)', color: '#ef4444', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <AlertCircle size={15} /> {passwordError}
                  </div>
                )}
                {passwordMessage && (
                  <div style={{ padding: '9px 13px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.28)', color: '#22c55e', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <CheckCircle2 size={15} /> {passwordMessage}
                  </div>
                )}

                {(['current', 'next', 'confirm'] as const).map((field) => {
                  const labels = { current: 'Current Password', next: 'New Password (min. 6 chars)', confirm: 'Confirm New Password' };
                  const keys = { current: 'currentPassword', next: 'newPassword', confirm: 'confirmPassword' } as const;
                  return (
                    <div key={field}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>
                        {labels[field]}
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPw[field] ? 'text' : 'password'}
                          value={passwordForm[keys[field]]}
                          onChange={e => setPasswordForm(p => ({ ...p, [keys[field]]: e.target.value }))}
                          placeholder={field === 'current' ? 'Enter current password' : field === 'next' ? 'Enter new password' : 'Confirm new password'}
                          className="input"
                          required
                          minLength={field !== 'current' ? 6 : undefined}
                          style={{ paddingRight: 40 }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(p => ({ ...p, [field]: !p[field] }))}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                        >
                          {showPw[field] ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button type="submit" disabled={savingPassword} className="btn btn-gradient" style={{ alignSelf: 'flex-start', padding: '10px 22px', fontSize: '0.88rem', fontWeight: 700, marginTop: 2 }}>
                  {savingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

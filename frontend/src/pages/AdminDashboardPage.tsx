import { useEffect, useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  PlusCircle,
  Calendar,
  QrCode,
  LogOut,
  GraduationCap,
  Star,
  MapPin,
  Clock,
  CalendarDays,
  Users,
  CheckCircle2,
  User,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import Alert from '../components/Alert';
import { useAuth } from '../context/AuthContext';
import { SkeletonStat } from '../components/SkeletonCard';
import EmptyState from '../components/EmptyState';
import { createEvent, deleteEvent, getEvents, updateEvent } from '../services/eventService';
import { getEventRegistrations } from '../services/registrationService';
import { getEventFeedback } from '../services/feedbackService';
import { getComments, addComment, deleteComment } from '../services/commentService';
import QrScannerModal from '../components/QrScannerModal';
import type { EventItem, FeedbackItem, CommentItem, RegistrationItem } from '../types';

// Chart colours
const CHART_COLORS = ['#4f46e5', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

//  palette
const C = {
  dark: '#1e1b4b',
  cyan: '#4f46e5',
  light: '#6b7280',
  yellow: '#4f46e5',
  orange: '#ef4444',
  bg: '#f5f6ff',
};

//  default form
const defaultForm = {
  title: '',
  description: '',
  type: 'other' as EventItem['type'],
  date: '',
  time: '',
  registrationDeadline: '',
  location: '',
  maxRegistrations: 100,
  eligibility: 'all' as 'all' | 'own_college',
  tags: [] as string[],
  imageFile: null as File | null,
  gdriveLink: '',
  // Certificate
  certificatesEnabled: false,
};

//  preset tags grouped by category
const PRESET_TAGS = [
  'AI',
  'ML',
  'Hackathon',
  'Coding',
  'Web Dev',
  'App Dev',
  'Cybersecurity',
  'Data Science',
  'Robotics',
  'IoT',
  'Design',
  'UI/UX',
  'Gaming',
  'Sports',
  'Music',
  'Cultural',
  'Workshop',
  'Seminar',
  'Networking',
  'Career',
];

//  tag picker component
const MAX_TAGS = 5;

function TagPicker({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [custom, setCustom] = useState('');
  const atMax = tags.length >= MAX_TAGS;

  const toggle = (tag: string) => {
    const lower = tag.toLowerCase();
    if (tags.includes(lower)) {
      // always allow removal
      onChange(tags.filter((t) => t !== lower));
    } else {
      if (atMax) return; // silently block — UI already shows disabled state
      onChange([...tags, lower]);
    }
  };

  const addCustom = () => {
    const t = custom.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) { setCustom(''); return; }
    if (atMax) return;
    onChange([...tags, t]);
    setCustom('');
  };

  return (
    <div>
      {/* preset chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {PRESET_TAGS.map((tag) => {
          const lower = tag.toLowerCase();
          const active = tags.includes(lower);
          const disabled = atMax && !active;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              disabled={disabled}
              style={{
                padding: '4px 12px',
                borderRadius: 99,
                fontSize: '0.78rem',
                fontWeight: 600,
                border: `1.5px solid ${active ? C.cyan : disabled ? 'var(--border)' : '#cde8f5'}`,
                background: active ? C.cyan : disabled ? 'var(--card-bg)' : '#f0f7fb',
                color: active ? '#fff' : disabled ? 'var(--text-dim)' : C.dark,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                transition: 'all 0.15s',
              }}
            >
              {active ? '✓ ' : ''}{tag}
            </button>
          );
        })}
      </div>

      {/* max tags notice */}
      {atMax && (
        <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600 }}>
          Maximum 5 tags selected. Remove a tag to add another.
        </p>
      )}

      {/* custom tag input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
          }}
          placeholder={atMax ? 'Remove a tag to add more' : 'Add custom tag'}
          disabled={atMax}
          style={{ ...inputStyle, flex: 1, opacity: atMax ? 0.5 : 1 }}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={atMax}
          style={{
            background: atMax ? 'var(--border)' : 'var(--grad-primary)',
            color: atMax ? 'var(--text-dim)' : '#fff',
            border: 0,
            borderRadius: 9,
            padding: '0 16px',
            cursor: atMax ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '0.88rem',
          }}
        >
          + Add
        </button>
      </div>

      {/* selected tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: 10 }}>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'var(--tag-bg, rgba(99,102,241,0.08))',
                color: 'var(--tag-text, #6366f1)',
                border: '1px solid var(--tag-border, rgba(99,102,241,0.22))',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              #{t.startsWith('#') ? t.slice(1) : t}
              <button
                type="button"
                onClick={() => onChange(tags.filter((x) => x !== t))}
                style={{
                  background: 'none',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--tag-text, #6366f1)',
                  fontWeight: 700,
                  padding: 0,
                  lineHeight: 1,
                  fontSize: '0.85rem',
                }}
                aria-label={`Remove ${t}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

//  small reusable stat card
function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="stat-card">
      <div
        className="stat-card-icon"
        style={{
          background: accent + '22',
          color: accent,
          fontSize: '1.1rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
      </div>
    </div>
  );
}

//  capacity progress bar
function CapacityBar({ count, max }: { count: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;
  const isFull = pct >= 90;
  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--gray-500)',
          marginBottom: 4,
        }}
      >
        <span>
          {count} / {max} registered
        </span>
        <span style={{ color: isFull ? 'var(--danger)' : 'var(--brand-600)', fontWeight: 600 }}>
          {pct}%
        </span>
      </div>
      <div className="capacity-bar">
        <div
          className={`capacity-bar-fill${isFull ? ' full' : ' normal'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

//  form field wrapper
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: '0.9rem',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  color: 'var(--text)',
  background: 'var(--surface-2)',
};

export default function AdminDashboardPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'create' | 'events' | 'attendance'>('overview');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [regCounts, setRegCounts] = useState<Record<string, number>>({});
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const [viewEvent, setViewEvent] = useState<EventItem | null>(null);
  const [viewRegs, setViewRegs] = useState<RegistrationItem[]>([]);

  // Feedback state
  const [feedbackEvent, setFeedbackEvent] = useState<EventItem | null>(null);
  const [feedbackData, setFeedbackData] = useState<{
    avgRating: number;
    feedbackCount: number;
    feedbacks: FeedbackItem[];
  } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Cancel event modal state
  const [cancelTarget, setCancelTarget] = useState<EventItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Q&A state
  const [qaEvent, setQaEvent] = useState<EventItem | null>(null);
  const [qaComments, setQaComments] = useState<CommentItem[]>([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [qaSubmitting, setQaSubmitting] = useState<string | null>(null);

  // QR Attendance Scanner state
  const [scannerTarget, setScannerTarget] = useState<{
    eventId: string;
    eventTitle: string;
    certificatesEnabled?: boolean;
  } | null>(null);

  const openQa = async (ev: EventItem) => {
    setQaEvent(ev);
    setQaLoading(true);
    try {
      const data = await getComments(ev._id);
      setQaComments(data);
    } catch {
      /* silent */
    } finally {
      setQaLoading(false);
    }
  };

  const handleAdminReply = async (eventId: string, parentId: string) => {
    const text = (replyInputs[parentId] || '').trim();
    if (!text) return;
    setQaSubmitting(parentId);
    try {
      await addComment(eventId, text, parentId);
      const updated = await getComments(eventId);
      setQaComments(updated);
      setReplyInputs((prev) => ({ ...prev, [parentId]: '' }));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      setFeedback({ type: 'error', message: err.response?.data?.msg || 'Failed to post reply.' });
    } finally {
      setQaSubmitting(null);
    }
  };

  const handleAdminDeleteComment = async (commentId: string, eventId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteComment(commentId);
      const updated = await getComments(eventId);
      setQaComments(updated);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      setFeedback({ type: 'error', message: err.response?.data?.msg || 'Failed to delete.' });
    }
  };

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
      const counts = await Promise.all(
        data.map(async (ev) => {
          try {
            return [ev._id, (await getEventRegistrations(ev._id)).length] as const;
          } catch {
            return [ev._id, 0] as const;
          }
        })
      );
      setRegCounts(Object.fromEntries(counts));
    } catch {
      setFeedback({ type: 'error', message: 'Unable to fetch events.' });
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const myEvents = events.filter((e) => e.createdBy === user?.id);
  const totalRegs = myEvents.reduce((s, e) => s + (regCounts[e._id] ?? 0), 0);
  const activeEvents = myEvents.filter((e) => new Date(e.registrationDeadline) > new Date()).length;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) =>
    setForm((prev) => ({
      ...prev,
      [e.target.name]:
        e.target.name === 'maxRegistrations' ? Number(e.target.value) : e.target.value,
    }));

  const clearForm = () => {
    setForm(defaultForm);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ed = new Date(form.date),
      dd = new Date(form.registrationDeadline),
      today = new Date();
    today.setHours(0, 0, 0, 0);
    ed.setHours(0, 0, 0, 0);
    dd.setHours(0, 0, 0, 0);
    if (ed < today) {
      alert('Event date cannot be in the past');
      return;
    }
    if (dd < today) {
      alert('Registration deadline cannot be in the past');
      return;
    }
    if (dd > ed) {
      alert('Registration deadline cannot be after event date');
      return;
    }
    if (form.maxRegistrations < 1) {
      alert(' Max registrations must be at least 1');
      return;
    }
    try {
      if (editingId) {
        await updateEvent(editingId, form);
        setFeedback({ type: 'success', message: 'Event updated.' });
        localStorage.setItem('events_last_updated', String(Date.now()));
      } else {
        await createEvent(form);
        setFeedback({ type: 'success', message: 'Event created!' });
        localStorage.setItem('events_last_updated', String(Date.now()));
      }
      clearForm();
      await loadEvents();
      setActiveTab('events');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      setFeedback({ type: 'error', message: err.response?.data?.msg || 'Failed to save event.' });
    }
  };

  const handleEdit = (ev: EventItem) => {
    setEditingId(ev._id);
    setForm({
      title: ev.title,
      description: ev.description,
      type: ev.type,
      date: ev.date.slice(0, 10),
      time: ev.time,
      registrationDeadline: ev.registrationDeadline.slice(0, 16),
      location: ev.location,
      maxRegistrations: ev.maxRegistrations ?? 100,
      eligibility: ev.eligibility ?? 'all',
      tags: ev.tags ?? [],
      imageFile: null,
      gdriveLink: ev.bannerSource === 'gdrive' ? (ev.bannerImage ?? '') : '',
      certificatesEnabled: ev.certificatesEnabled ?? false,
    });
    setActiveTab('create');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (ev: EventItem) => {
    setCancelTarget(ev);
    setCancelReason('');
  };

  const confirmDelete = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await deleteEvent(cancelTarget._id, cancelReason);
      setFeedback({
        type: 'success',
        message: `"${cancelTarget.title}" cancelled. All registered students have been notified.`,
      });
      setCancelTarget(null);
      await loadEvents();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      setFeedback({ type: 'error', message: err.response?.data?.msg || 'Delete failed.' });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleViewRegs = async (ev: EventItem) => {
    try {
      setViewRegs(await getEventRegistrations(ev._id));
      setViewEvent(ev);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load registrations.' });
    }
  };

  const handleViewFeedback = async (ev: EventItem) => {
    setFeedbackLoading(true);
    setFeedbackEvent(ev);
    setFeedbackData(null);
    try {
      const data = await getEventFeedback(ev._id);
      setFeedbackData(data);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { msg?: string } } };
      setFeedback({
        type: 'error',
        message: err.response?.data?.msg || 'Failed to load feedback.',
      });
      setFeedbackEvent(null);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  //  sidebar nav item
  const NavItem = ({
    id,
    icon,
    label,
    badge,
  }: {
    id: typeof activeTab;
    icon: React.ReactNode;
    label: string;
    badge?: number;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`admin-nav-item${activeTab === id ? ' active' : ''}`}
    >
      <span
        style={{
          fontSize: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && <span className="nav-badge">{badge > 9 ? '9+' : badge}</span>}
    </button>
  );


  return (
    <div className="admin-layout">
      {/*  SIDEBAR  */}
      <aside className="admin-sidebar">
        {/* Brand */}
        <div className="admin-sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg,#4f46e5,#8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <GraduationCap size={16} color="#fff" />
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: '-0.02em',
              }}
            >
              CampusEvents
            </h2>
          </div>
          <p
            style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', paddingLeft: 42 }}
          >
            Admin Panel
          </p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <NavItem id="overview" icon={<LayoutDashboard size={16} />} label="Overview" />
          <NavItem id="create" icon={<PlusCircle size={16} />} label="Create Event" />
          <NavItem id="events" icon={<Calendar size={16} />} label="My Events" />
          <NavItem id="attendance" icon={<QrCode size={16} />} label="Attendance" />
        </nav>

        {/* Bottom actions */}
        <div style={{ display: 'flex', gap: 8, padding: '0 4px' }}>
          <button
            onClick={() => navigate('/profile')}
            className="theme-toggle"
            title="View profile"
            aria-label="View profile"
            style={{ flex: 'none' }}
            type="button"
          >
            <User size={16} />
          </button>
          <button
            onClick={handleLogout}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              border: 0,
              cursor: 'pointer',
              background: 'rgba(239,68,68,0.12)',
              color: 'var(--danger)',
              fontWeight: 600,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.22)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)';
            }}
            type="button"
          >
            <LogOut size={16} /> <span>Logout</span>
          </button>
        </div>
      </aside>

      {/*  MAIN  */}
      <main className="admin-main">
        {/* Header */}
        <div className="admin-header">
          <h1>
            {activeTab === 'overview' && 'Dashboard'}
            {activeTab === 'create' && (editingId ? 'Update Event' : 'Create Event')}
            {activeTab === 'events' && 'My Events'}
            {activeTab === 'attendance' && 'Attendance'}
          </h1>
          <p>
            {activeTab === 'overview'
              ? `Welcome back${user?.collegeName ? `, ${user.collegeName}` : ''}`
              : ''}
          </p>
        </div>

        {feedback && (
          <div style={{ marginBottom: 20 }}>
            <Alert type={feedback.type} message={feedback.message} />
          </div>
        )}

        {/*  OVERVIEW TAB  */}
        {activeTab === 'overview' && (
          <div className="anim-fade-up">
            {/* Stat cards */}
            {eventsLoading ? (
              <div className="stat-cards-grid" style={{ marginBottom: 28 }}>
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonStat key={i} />
                ))}
              </div>
            ) : (
              <div className="stat-cards-grid" style={{ marginBottom: 28 }}>
                <StatCard
                  label="My Events"
                  value={myEvents.length}
                  icon={<CalendarDays size={18} />}
                  accent="#4f46e5"
                />
                <StatCard
                  label="Total Registrations"
                  value={totalRegs}
                  icon={<Users size={18} />}
                  accent="#8b5cf6"
                />
                <StatCard
                  label="Active Events"
                  value={activeEvents}
                  icon={<CheckCircle2 size={18} />}
                  accent="#10b981"
                />
              </div>
            )}

            {/* Charts row */}
            {myEvents.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))',
                  gap: 20,
                  marginBottom: 28,
                }}
              >
                {/* Bar chart  registrations per event */}
                <div className="chart-card">
                  <h4>Registrations by Event</h4>
                  <p>Student sign-ups per event</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={myEvents.slice(0, 6).map((ev) => ({
                        name: ev.title.length > 12 ? ev.title.slice(0, 12) + '…' : ev.title,
                        count: regCounts[ev._id] ?? 0,
                      }))}
                      margin={{ top: 4, right: 8, bottom: 4, left: -20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 10,
                          border: 'none',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                        {myEvents.slice(0, 6).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie chart  event types */}
                <div className="chart-card">
                  <h4>Events by Category</h4>
                  <p>Distribution across event types</p>
                  {(() => {
                    const typeMap: Record<string, number> = {};
                    myEvents.forEach((e) => {
                      typeMap[e.type] = (typeMap[e.type] ?? 0) + 1;
                    });
                    const pieData = Object.entries(typeMap).map(([name, value]) => ({
                      name,
                      value,
                    }));
                    return (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: 10,
                              border: 'none',
                              fontSize: 12,
                              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                            }}
                          />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Events table */}
            <div className="dashboard-section" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--gray-100)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Event Summary</h3>
                <button
                  onClick={() => setActiveTab('create')}
                  className="btn btn-gradient"
                  style={{ padding: '8px 18px', fontSize: '0.82rem' }}
                >
                  + New Event
                </button>
              </div>
              {eventsLoading ? (
                <div style={{ padding: 20 }}>
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="skeleton skeleton-line"
                      style={{ marginBottom: 12, height: 44 }}
                    />
                  ))}
                </div>
              ) : myEvents.length === 0 ? (
                <EmptyState
                  icon="&#128197;"
                  title="No events yet"
                  description="Create your first event to get started."
                />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}
                  >
                    <thead>
                      <tr style={{ background: 'var(--gray-50)' }}>
                        {['Event', 'Date', 'Registrations', 'Status', 'Actions'].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: '11px 16px',
                              textAlign: 'left',
                              color: 'var(--gray-500)',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              borderBottom: '1px solid var(--gray-100)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {myEvents.map((ev) => {
                        const count = regCounts[ev._id] ?? 0;
                        const max = ev.maxRegistrations ?? 100;
                        const open = new Date(ev.registrationDeadline) > new Date();
                        return (
                          <tr
                            key={ev._id}
                            style={{
                              borderBottom: '1px solid var(--gray-50)',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLTableRowElement).style.background =
                                'var(--gray-50)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLTableRowElement).style.background = '';
                            }}
                          >
                            <td
                              style={{
                                padding: '12px 16px',
                                fontWeight: 600,
                                color: 'var(--gray-900)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: open ? '#10b981' : '#9ca3af',
                                    flexShrink: 0,
                                  }}
                                />
                                {ev.title}
                              </div>
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                color: 'var(--gray-500)',
                                whiteSpace: 'nowrap',
                                fontSize: '0.82rem',
                              }}
                            >
                              {new Date(ev.date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td style={{ padding: '12px 16px', minWidth: 160 }}>
                              <span style={{ fontWeight: 700, color: 'var(--gray-900)' }}>
                                {count}
                              </span>
                              <span style={{ color: 'var(--gray-400)', fontSize: '0.82rem' }}>
                                {' '}
                                / {max}
                              </span>
                              <CapacityBar count={count} max={max} />
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span
                                style={{
                                  background: open ? '#dcfce7' : 'var(--gray-100)',
                                  color: open ? '#166534' : 'var(--gray-500)',
                                  borderRadius: 99,
                                  padding: '3px 10px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                {open ? 'Active' : 'Closed'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: 5 }}>
                                <button
                                  onClick={() => handleViewRegs(ev)}
                                  style={{
                                    background: 'var(--gray-100)',
                                    color: 'var(--gray-700)',
                                    border: 0,
                                    borderRadius: 7,
                                    padding: '5px 10px',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    transition: 'background 0.15s',
                                  }}
                                >
                                  Registrants
                                </button>
                                <button
                                  onClick={() => handleEdit(ev)}
                                  style={{
                                    background: 'var(--brand-50)',
                                    color: 'var(--brand-700)',
                                    border: 0,
                                    borderRadius: 7,
                                    padding: '5px 10px',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() =>
                                    setScannerTarget({
                                      eventId: ev._id,
                                      eventTitle: ev.title,
                                      certificatesEnabled: ev.certificatesEnabled,
                                    })
                                  }
                                  style={{
                                    background: 'rgba(168,85,247,0.15)',
                                    color: '#7c3aed',
                                    border: 0,
                                    borderRadius: 7,
                                    padding: '5px 10px',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  QR
                                </button>
                                <button
                                  onClick={() => handleDelete(ev)}
                                  style={{
                                    background: 'rgba(239,68,68,0.1)',
                                    color: '#dc2626',
                                    border: 0,
                                    borderRadius: 7,
                                    padding: '5px 10px',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/*  CREATE / EDIT TAB  */}
        {activeTab === 'create' && (
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: 28,
              maxWidth: 680,
            }}
          >
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
              <Field label="Event Title">
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. Annual Hackathon 2025"
                  style={inputStyle}
                  required
                />
              </Field>
              <Field label="Description">
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe the event"
                  style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                  required
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Category">
                  <select name="type" value={form.type} onChange={handleChange} style={inputStyle}>
                    {['hackathon', 'tech', 'seminar', 'games', 'movie', 'other'].map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Location">
                  <input
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Venue / Room"
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label="Event Date">
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label="Event Time">
                  <input
                    type="time"
                    name="time"
                    value={form.time}
                    onChange={handleChange}
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label="Registration Deadline">
                  <input
                    type="datetime-local"
                    name="registrationDeadline"
                    value={form.registrationDeadline}
                    onChange={handleChange}
                    min={new Date().toISOString().slice(0, 16)}
                    style={inputStyle}
                    required
                  />
                </Field>
                <Field label="Max Registrations">
                  <input
                    type="number"
                    name="maxRegistrations"
                    value={form.maxRegistrations}
                    onChange={handleChange}
                    min={1}
                    style={inputStyle}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                    Set the maximum number of participants
                  </span>
                </Field>
                <Field label="Who can register?">
                  <select
                    name="eligibility"
                    value={form.eligibility}
                    onChange={handleChange}
                    style={inputStyle}
                  >
                    <option value="all"> Open to all colleges</option>
                    <option value="own_college"> My college students only</option>
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 2 }}>
                    {form.eligibility === 'own_college'
                      ? 'Only students from your college can register'
                      : 'Students from any college can register'}
                  </span>
                </Field>
              </div>
              <Field label="Tags / Keywords">
                <TagPicker
                  tags={form.tags}
                  onChange={(tags) => setForm((prev) => ({ ...prev, tags }))}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: 4 }}>
                  Tags help students discover your event via search
                </span>
              </Field>

              {/*  Banner image  */}
              <Field label="Event Banner Image">
                <div style={{ display: 'grid', gap: 10 }}>
                  {/* Option A: upload from computer */}
                  <div>
                    <label
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Upload from computer (JPG, PNG, WebP max 5 MB)
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setForm((prev) => ({
                          ...prev,
                          imageFile: file,
                          gdriveLink: file ? '' : prev.gdriveLink,
                        }));
                      }}
                      style={{ ...inputStyle, padding: '7px 12px', cursor: 'pointer' }}
                    />
                    {form.imageFile && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#10b981' }}>
                        {form.imageFile.name} ({(form.imageFile.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>

                  <div
                    style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem' }}
                  >
                    — or —
                  </div>

                  {/* Option B: Google Drive link */}
                  <div>
                    <label
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: 4,
                      }}
                    >
                      Google Drive share link
                    </label>
                    <input
                      type="text"
                      value={form.gdriveLink}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          gdriveLink: e.target.value,
                          imageFile: e.target.value ? null : prev.imageFile,
                        }))
                      }
                      placeholder="https://drive.google.com/file/d/FILE_ID/view"
                      style={inputStyle}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                      Share the file publicly in Google Drive, then paste the link here.
                    </p>
                  </div>
                </div>
              </Field>

              {/*  Certificate Setting  */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--text)', fontSize: '0.95rem' }}>
                  🎓 Certificates
                </h4>
                <label
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={form.certificatesEnabled}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, certificatesEnabled: e.target.checked }))
                    }
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#7c3aed' }}
                  />
                  <div>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>
                      Enable certificates for this event
                    </span>
                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Students who attend will be able to download a certificate after the event.
                    </p>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  style={{
                    background: 'var(--grad-primary)',
                    color: '#fff',
                    border: 0,
                    borderRadius: 10,
                    padding: '12px 28px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                  }}
                >
                  {editingId ? 'Update Event' : 'Create Event'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={clearForm}
                    style={{
                      background: '#e2e8f0',
                      color: 'var(--text)',
                      border: 0,
                      borderRadius: 10,
                      padding: '12px 20px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/*  MY EVENTS TAB  */}
        {activeTab === 'events' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))',
              gap: 20,
            }}
          >
            {events.length === 0 && (
              <p style={{ color: 'var(--text-dim)', gridColumn: '1/-1' }}>No events found.</p>
            )}
            {events.map((ev) => {
              const count = regCounts[ev._id] ?? ev.registrationCount ?? 0;
              const max = ev.maxRegistrations ?? 100;
              const isOpen = new Date(ev.registrationDeadline) > new Date();
              const isMine = ev.createdBy === user?.id;
              return (
                <div
                  key={ev._id}
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: '0 2px 12px rgba(2,48,71,0.08)',
                    border: `1px solid ${isMine ? C.light : '#e2e8f0'}`,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      '0 10px 28px rgba(2,48,71,0.14)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                    (e.currentTarget as HTMLDivElement).style.boxShadow =
                      '0 2px 12px rgba(2,48,71,0.08)';
                  }}
                >
                  {/* card header */}
                  <div
                    style={{
                      background: 'var(--grad-primary)',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        background: 'var(--primary)',
                        color: 'var(--text)',
                        borderRadius: 99,
                        padding: '2px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'capitalize',
                      }}
                    >
                      {ev.type}
                    </span>
                    <span
                      style={{
                        background: isOpen ? '#dcfce7' : '#fee2e2',
                        color: isOpen ? '#166534' : '#991b1b',
                        borderRadius: 99,
                        padding: '2px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {isOpen ? 'Active' : 'Closed'}
                    </span>
                  </div>

                  <div style={{ padding: '16px' }}>
                    <h4 style={{ margin: '0 0 6px', color: 'var(--text)', fontSize: '1rem' }}>
                      {ev.title}
                    </h4>
                    {ev.tags && ev.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: 8 }}>
                        {ev.tags.map((t) => (
                          <span
                            key={t}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              background: 'var(--tag-bg, rgba(99,102,241,0.08))',
                              color: 'var(--tag-text, #6366f1)',
                              border: '1px solid var(--tag-border, rgba(99,102,241,0.22))',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              letterSpacing: '0.01em',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            #{t.startsWith('#') ? t.slice(1) : t}
                          </span>
                        ))}
                      </div>
                    )}
                    <p
                      style={{
                        margin: '0 0 12px',
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {ev.description?.slice(0, 80)}
                      {(ev.description?.length ?? 0) > 80 ? '…' : ''}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        fontSize: '0.8rem',
                        color: 'var(--text-dim)',
                        marginBottom: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>
                        <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                        {new Date(ev.date).toLocaleDateString()}
                      </span>
                      <span>
                        <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                        {ev.time}
                      </span>
                      <span>
                        <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                        {ev.location}
                      </span>
                    </div>

                    <CapacityBar count={count} max={max} />

                    {/* avg rating for past events */}
                    {new Date(ev.date) < new Date() && ev.avgRating != null && ev.avgRating > 0 && (
                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: '#FFB703',
                          fontWeight: 600,
                          marginTop: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            size={12}
                            fill={i < Math.round(ev.avgRating!) ? '#FFB703' : 'none'}
                            color="#FFB703"
                          />
                        ))}
                        <span style={{ color: 'var(--text-dim)', fontWeight: 400, marginLeft: 4 }}>
                          {ev.avgRating!.toFixed(1)} ({ev.feedbackCount} reviews)
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleViewRegs(ev)}
                        style={{
                          flex: 1,
                          background: 'rgba(255,255,255,0.08)',
                          color: 'var(--text)',
                          border: 0,
                          borderRadius: 8,
                          padding: '8px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                        }}
                      >
                        <GraduationCap
                          size={13}
                          style={{ verticalAlign: 'middle', marginRight: 4 }}
                        />
                        Registrants
                      </button>
                      {/* Show feedback button only for past events owned by this admin */}
                      {isMine && new Date(ev.date) < new Date() && (
                        <button
                          onClick={() => void handleViewFeedback(ev)}
                          style={{
                            background: '#FFB703',
                            color: 'var(--text)',
                            border: 0,
                            borderRadius: 8,
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                          }}
                        >
                          ⭐ Feedback
                        </button>
                      )}
                      {isMine && (
                        <>
                          <button
                            onClick={() => void openQa(ev)}
                            style={{
                              background: 'rgba(108,99,255,0.15)',
                              color: '#4f46e5',
                              border: 0,
                              borderRadius: 8,
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                            }}
                          >
                            💬 Q&A
                          </button>
                          <button
                            onClick={() => handleEdit(ev)}
                            style={{
                              background: 'var(--primary)',
                              color: '#fff',
                              border: 0,
                              borderRadius: 8,
                              padding: '8px 14px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(ev)}
                            style={{
                              background: 'var(--danger)',
                              color: '#fff',
                              border: 0,
                              borderRadius: 8,
                              padding: '8px 14px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                    {!isMine && (
                      <p
                        style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}
                      >
                        Created by another admin
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/*  ATTENDANCE TAB  */}
        {activeTab === 'attendance' && (
          <div>
            <p style={{ marginBottom: 20, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Select an event to open the QR scanner and mark attendance.
            </p>
            {myEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}></div>
                <p style={{ margin: 0, fontWeight: 600 }}>No events to scan for</p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
                  gap: 14,
                }}
              >
                {myEvents.map((ev) => (
                  <div
                    key={ev._id}
                    style={{
                      background: 'var(--surface-2)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      padding: '16px 18px',
                      boxShadow: '0 2px 8px rgba(2,48,71,0.06)',
                    }}
                  >
                    <p
                      style={{
                        margin: '0 0 4px',
                        fontWeight: 700,
                        color: 'var(--text)',
                        fontSize: '0.95rem',
                      }}
                    >
                      {ev.title}
                    </p>
                    <p
                      style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}
                    >
                      {new Date(ev.date).toLocaleDateString()} {ev.location}
                    </p>
                    {ev.certificatesEnabled && (
                      <span
                        style={{
                          background: 'rgba(168,85,247,0.15)',
                          color: '#7c3aed',
                          borderRadius: 99,
                          padding: '2px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          display: 'inline-block',
                          marginBottom: 10,
                        }}
                      >
                        🎓 Certificates Active
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setScannerTarget({
                          eventId: ev._id,
                          eventTitle: ev.title,
                          certificatesEnabled: ev.certificatesEnabled,
                        })
                      }
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg,#023047,#1e3a5f)',
                        color: '#fff',
                        border: 0,
                        borderRadius: 9,
                        padding: '10px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.88rem',
                      }}
                    >
                      Open QR Scanner
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/*  QR SCANNER MODAL  */}
      {scannerTarget && (
        <QrScannerModal
          eventId={scannerTarget.eventId}
          eventTitle={scannerTarget.eventTitle}
          certificatesEnabled={scannerTarget.certificatesEnabled}
          onClose={() => setScannerTarget(null)}
        />
      )}

      {/*  REGISTRANTS MODAL  */}
      {viewEvent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,48,71,0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setViewEvent(null)}
        >
          <div
            style={{
              width: 'min(700px,100%)',
              background: 'var(--surface-2)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 24px 60px rgba(2,48,71,0.25)',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--text)' }}>{viewEvent.title}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {viewRegs.length} registrant(s)
                </p>
              </div>
              <button
                onClick={() => setViewEvent(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 0,
                  borderRadius: 8,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                ✕ Close
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {viewRegs.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)' }}>
                  No registrations yet.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)' }}>
                    <tr style={{ borderBottom: `2px solid ${C.light}` }}>
                      {['Name', 'College ID', 'College', 'Department'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 12px',
                            textAlign: 'left',
                            color: 'var(--text)',
                            fontWeight: 600,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewRegs.map((r, i) => (
                      <tr
                        key={r._id || i}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: i % 2 === 0 ? '#fff' : '#f8fafc',
                        }}
                      >
                        <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                          {r.name || 'N/A'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                          {r.collegeId || 'N/A'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                          {r.collegeName || 'N/A'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                          {r.department || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/*  FEEDBACK MODAL  */}
      {feedbackEvent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,48,71,0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setFeedbackEvent(null)}
        >
          <div
            style={{
              width: 'min(700px,100%)',
              background: 'var(--surface-2)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 24px 60px rgba(2,48,71,0.25)',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--text)' }}>
                  ⭐ Feedback — {feedbackEvent.title}
                </h3>
                {feedbackData && (
                  <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Avg:{' '}
                    <strong style={{ color: '#FFB703' }}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={12}
                          fill={i < Math.round(feedbackData.avgRating) ? '#FFB703' : 'none'}
                          color="#FFB703"
                          style={{ verticalAlign: 'middle' }}
                        />
                      ))}{' '}
                      {feedbackData.avgRating.toFixed(1)}
                    </strong>
                    &nbsp;&nbsp;{feedbackData.feedbackCount} response(s)
                  </p>
                )}
              </div>
              <button
                onClick={() => setFeedbackEvent(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 0,
                  borderRadius: 8,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                ✕ Close
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {feedbackLoading ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)' }}>
                  Loading feedback
                </div>
              ) : !feedbackData || feedbackData.feedbacks.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)' }}>
                  No feedback submitted yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {feedbackData.feedbacks.map((fb, i) => {
                    const u = typeof fb.userId === 'object' ? fb.userId : null;
                    return (
                      <div
                        key={fb._id || i}
                        style={{
                          background: 'var(--surface)',
                          borderRadius: 10,
                          padding: '14px 16px',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 6,
                          }}
                        >
                          <div>
                            <span
                              style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}
                            >
                              {u?.name || 'Anonymous'}
                            </span>
                            {u?.collegeName && (
                              <span
                                style={{
                                  color: 'var(--text-dim)',
                                  fontSize: '0.78rem',
                                  marginLeft: 8,
                                }}
                              >
                                {u.collegeName}
                              </span>
                            )}
                          </div>
                          <span
                            style={{
                              color: '#FFB703',
                              fontSize: '1rem',
                              display: 'flex',
                              gap: 2,
                              alignItems: 'center',
                            }}
                          >
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star
                                key={i}
                                size={14}
                                fill={i < fb.rating ? '#FFB703' : 'none'}
                                color="#FFB703"
                              />
                            ))}
                          </span>
                        </div>
                        {fb.comment && (
                          <p
                            style={{
                              margin: 0,
                              color: 'var(--text-2)',
                              fontSize: '0.88rem',
                              lineHeight: 1.5,
                            }}
                          >
                            {fb.comment}
                          </p>
                        )}
                        <p
                          style={{
                            margin: '6px 0 0',
                            color: 'var(--text-dim)',
                            fontSize: '0.75rem',
                          }}
                        >
                          {new Date(fb.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/*  CANCEL EVENT MODAL  */}
      {cancelTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,48,71,0.6)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => !cancelLoading && setCancelTarget(null)}
        >
          <div
            style={{
              width: 'min(480px,100%)',
              background: 'var(--surface-2)',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 24px 60px rgba(2,48,71,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: '1.4rem',
                }}
              ></div>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.1rem' }}>
                  Cancel Event
                </h3>
                <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {cancelTarget.title}
                </p>
              </div>
            </div>

            {/* Warning */}
            <div
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '12px 14px',
                marginBottom: 20,
                fontSize: '0.85rem',
                color: '#991b1b',
              }}
            >
              This will <strong>permanently delete</strong> the event and send a cancellation email
              to all {regCounts[cancelTarget._id] ?? 0} registered student(s).
            </div>

            {/* Reason input */}
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 6,
              }}
            >
              Reason for cancellation{' '}
              <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                (optional shown in the email)
              </span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Venue unavailable, insufficient registrations, rescheduled"
              rows={3}
              style={{
                width: '100%',
                border: '1px solid var(--border)',
                borderRadius: 9,
                padding: '10px 12px',
                fontSize: '0.9rem',
                outline: 'none',
                resize: 'vertical',
                marginBottom: 20,
              }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={cancelLoading}
                style={{
                  flex: 1,
                  background: '#dc2626',
                  color: '#fff',
                  border: 0,
                  borderRadius: 10,
                  padding: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                {cancelLoading ? 'Cancelling & notifying' : 'Cancel Event & Notify Students'}
              </button>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelLoading}
                style={{
                  background: '#e2e8f0',
                  color: 'var(--text)',
                  border: 0,
                  borderRadius: 10,
                  padding: '12px 18px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}

      {/*  Q&A MODAL  */}
      {qaEvent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,48,71,0.55)',
            display: 'grid',
            placeItems: 'center',
            padding: 16,
            zIndex: 50,
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setQaEvent(null)}
        >
          <div
            style={{
              width: 'min(640px,100%)',
              background: 'var(--surface-2)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 24px 60px rgba(2,48,71,0.25)',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: 'var(--text)' }}>💬 Q&A — {qaEvent.title}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {qaComments.length} question{qaComments.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setQaEvent(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 0,
                  borderRadius: 8,
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {qaLoading ? (
                <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0' }}>
                  Loading questions
                </p>
              ) : qaComments.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px 0' }}>
                  No questions yet.
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                  {qaComments.map((c) => {
                    const author = typeof c.userId === 'object' ? c.userId : null;
                    return (
                      <div
                        key={c._id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          overflow: 'hidden',
                        }}
                      >
                        {/* Question */}
                        <div style={{ background: 'var(--surface)', padding: '12px 14px' }}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  marginBottom: 4,
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    color: 'var(--text)',
                                  }}
                                >
                                  {author?.name ?? 'Student'}
                                </span>
                                {author?.collegeName && (
                                  <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                                    {author.collegeName}
                                  </span>
                                )}
                                <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                                  {new Date(c.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '0.9rem',
                                  color: 'var(--text-2)',
                                  lineHeight: 1.5,
                                }}
                              >
                                {c.text}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleAdminDeleteComment(c._id, qaEvent._id)}
                              style={{
                                background: 'none',
                                border: 0,
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                padding: '2px 6px',
                                flexShrink: 0,
                              }}
                            ></button>
                          </div>
                        </div>

                        {/* Existing replies */}
                        {c.replies?.length > 0 && (
                          <div
                            style={{
                              padding: '10px 14px',
                              background: 'rgba(34,197,94,0.1)',
                              borderTop: '1px solid #bbf7d0',
                            }}
                          >
                            {c.replies.map((r) => (
                              <div
                                key={r._id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      marginBottom: 3,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        color: '#166534',
                                      }}
                                    >
                                      You (Admin)
                                    </span>
                                    <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                                      {new Date(r.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: '0.87rem',
                                      color: '#166534',
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {r.text}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void handleAdminDeleteComment(r._id, qaEvent._id)}
                                  style={{
                                    background: 'none',
                                    border: 0,
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    padding: '2px 6px',
                                    flexShrink: 0,
                                  }}
                                ></button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply input  only if no reply yet */}
                        {(!c.replies || c.replies.length === 0) && (
                          <div
                            style={{
                              padding: '10px 14px',
                              borderTop: '1px solid var(--border)',
                              display: 'flex',
                              gap: 8,
                            }}
                          >
                            <input
                              value={replyInputs[c._id] ?? ''}
                              onChange={(e) =>
                                setReplyInputs((prev) => ({ ...prev, [c._id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  void handleAdminReply(qaEvent._id, c._id);
                                }
                              }}
                              placeholder="Type your answer"
                              style={{
                                flex: 1,
                                border: '1.5px solid #cde8f5',
                                borderRadius: 8,
                                padding: '8px 12px',
                                fontSize: '0.85rem',
                                outline: 'none',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void handleAdminReply(qaEvent._id, c._id)}
                              disabled={
                                qaSubmitting === c._id || !(replyInputs[c._id] ?? '').trim()
                              }
                              style={{
                                background: 'var(--grad-primary)',
                                color: '#fff',
                                border: 0,
                                borderRadius: 8,
                                padding: '0 16px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {qaSubmitting === c._id ? '' : 'Answer'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

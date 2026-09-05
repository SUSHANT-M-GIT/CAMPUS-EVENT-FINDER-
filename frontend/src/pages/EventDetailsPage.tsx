import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  ArrowLeft,
  Star,
  Award,
  AlertCircle,
  CalendarCheck,
} from 'lucide-react';
import AppNavbar from '../components/AppNavbar';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { getEventById } from '../services/eventService';
import type { EventItem } from '../types';

const TYPE_COLORS: Record<string, string> = {
  hackathon: '#6c63ff',
  tech: '#38bdf8',
  seminar: '#a855f7',
  games: '#22c55e',
  movie: '#f59e0b',
  other: '#94a3b8',
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDeadline(d: string) {
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EventDetailsPage() {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    getEventById(id)
      .then(setEvent)
      .catch(() => setError('Event not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const now = new Date();
  const eventClosed = Boolean(
    event &&
      (new Date(event.registrationDeadline) < now || new Date(event.date) < now)
  );

  const slotsLeft =
    event?.maxRegistrations != null
      ? event.maxRegistrations - (event.registrationCount ?? 0)
      : null;

  const fillPct =
    event?.maxRegistrations && event.maxRegistrations > 0
      ? Math.min(100, ((event.registrationCount ?? 0) / event.maxRegistrations) * 100)
      : 0;

  const accentColor = event ? (TYPE_COLORS[event.type] ?? '#6c63ff') : '#6c63ff';

  const handleRegister = () => {
    navigate('/', { state: { registerEventId: id } });
  };

  const navLinks = user
    ? [
        { label: 'Dashboard', to: user.role === 'admin' ? '/admin' : '/user' },
        { label: 'My Registrations', to: '/my-registrations' },
        { label: 'Profile', to: '/profile' },
        { label: 'Logout', onClick: () => { logout(); navigate('/login'); } },
      ]
    : [
        { label: 'Login', to: '/login' },
        { label: 'Sign Up', to: '/signup' },
      ];

  if (loading) return <LoadingSpinner />;

  if (error || !event) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <AppNavbar links={navLinks} userName={user?.name} userInitial={user?.name?.[0]} />
        <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
          <AlertCircle size={48} color="var(--danger)" style={{ marginBottom: 16 }} />
          <h2 style={{ color: 'var(--text)', marginBottom: 8 }}>Event not found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            This event may have been removed or the link is invalid.
          </p>
          <Link to="/" className="btn btn-gradient">Back to Events</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <AppNavbar links={navLinks} userName={user?.name} userInitial={user?.name?.[0]} />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '32px 16px 64px' }}>

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="btn btn-outline btn-sm"
          style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Banner */}
        {event.bannerImage && (
          <div style={{
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 24,
            height: 260,
            background: 'var(--surface-2)',
          }}>
            <img
              src={event.bannerImage}
              alt={event.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {/* Main card */}
        <div style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
          borderLeft: `4px solid ${accentColor}`,
        }}>

          {/* Card header */}
          <div style={{ padding: '28px 28px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Type + status badges */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{
                    background: `${accentColor}22`,
                    color: accentColor,
                    border: `1px solid ${accentColor}44`,
                    borderRadius: 99,
                    padding: '3px 12px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {event.type}
                  </span>
                  <span style={{
                    background: eventClosed ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                    color: eventClosed ? '#f87171' : '#4ade80',
                    border: `1px solid ${eventClosed ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
                    borderRadius: 99,
                    padding: '3px 12px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}>
                    {eventClosed ? 'CLOSED' : 'OPEN'}
                  </span>
                  {event.certificatesEnabled && (
                    <span style={{
                      background: 'rgba(168,85,247,0.12)',
                      color: '#c084fc',
                      border: '1px solid rgba(168,85,247,0.3)',
                      borderRadius: 99,
                      padding: '3px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <Award size={10} /> Certificate
                    </span>
                  )}
                </div>

                {/* Title */}
                <h1 style={{
                  fontSize: 'clamp(1.4rem, 3vw, 1.9rem)',
                  fontWeight: 800,
                  color: 'var(--text)',
                  margin: '0 0 8px',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}>
                  {event.title}
                </h1>

                {/* Rating */}
                {(event.avgRating ?? 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <Star size={14} color="#f59e0b" fill="#f59e0b" />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {event.avgRating?.toFixed(1)} ({event.feedbackCount} reviews)
                    </span>
                  </div>
                )}
              </div>

              {/* Slots summary — top right */}
              {slotsLeft !== null && (
                <div style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '12px 18px',
                  textAlign: 'center',
                  flexShrink: 0,
                }}>
                  <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: slotsLeft === 0 ? 'var(--danger)' : 'var(--success)', lineHeight: 1 }}>
                    {slotsLeft}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    slots left
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            <p style={{
              color: 'var(--text-muted)',
              fontSize: '0.95rem',
              lineHeight: 1.75,
              margin: '16px 0 0',
            }}>
              {event.description}
            </p>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '0 28px' }} />

          {/* Event details grid */}
          <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={16} color={accentColor} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.88rem', color: 'var(--text-2)', fontWeight: 600 }}>{formatDate(event.date)}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={16} color={accentColor} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.88rem', color: 'var(--text-2)', fontWeight: 600 }}>{event.time || 'TBD'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={16} color={accentColor} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Venue</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.88rem', color: 'var(--text-2)', fontWeight: 600 }}>{event.location || 'TBD'}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarCheck size={16} color={accentColor} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registration Deadline</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.88rem', color: eventClosed ? 'var(--danger)' : 'var(--text-2)', fontWeight: 600 }}>
                  {formatDeadline(event.registrationDeadline)}
                </p>
              </div>
            </div>

            {event.maxRegistrations != null && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={16} color={accentColor} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capacity</p>
                  <p style={{ margin: '2px 0 4px', fontSize: '0.88rem', color: 'var(--text-2)', fontWeight: 600 }}>
                    {event.registrationCount ?? 0} / {event.maxRegistrations} registered
                  </p>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${fillPct}%`,
                      borderRadius: 99,
                      background: fillPct >= 90 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : `linear-gradient(90deg,${accentColor},#a855f7)`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              </div>
            )}

            {event.eligibility === 'own_college' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <AlertCircle size={16} color="#f59e0b" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eligibility</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.88rem', color: '#fcd34d', fontWeight: 600 }}>Same college only</p>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '0 28px' }} />
              <div style={{ padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Tag size={14} color="var(--text-dim)" />
                {event.tags.map((tag) => (
                  <span key={tag} style={{
                    background: 'rgba(108,99,255,0.1)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(108,99,255,0.2)',
                    borderRadius: 99,
                    padding: '3px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Register CTA */}
          {(user?.role === 'student' || user?.role === 'professional') && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '0 28px' }} />
              <div style={{ padding: '20px 28px' }}>
                {error && <Alert type="error" message={error} />}
                {eventClosed ? (
                  <div style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    color: '#f87171',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <AlertCircle size={16} />
                    Registration is closed for this event.
                  </div>
                ) : (
                  <button
                    onClick={handleRegister}
                    className="btn btn-gradient"
                    style={{ width: '100%', padding: '13px', fontSize: '1rem', fontWeight: 700 }}
                  >
                    Register for this Event
                  </button>
                )}
              </div>
            </>
          )}

          {/* Not logged in CTA */}
          {!user && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '0 28px' }} />
              <div style={{ padding: '20px 28px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 14, fontSize: '0.9rem' }}>
                  Log in to register for this event
                </p>
                <Link to="/login" className="btn btn-gradient" style={{ padding: '11px 32px' }}>
                  Log In
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

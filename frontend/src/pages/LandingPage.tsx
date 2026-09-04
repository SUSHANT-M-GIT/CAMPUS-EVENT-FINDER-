import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap,
  ArrowRight,
  Calendar,
  MapPin,
  QrCode,
  Bell,
  Award,
  Users,
  Menu,
  X,
} from 'lucide-react';
import api from '../services/api';
import type { EventItem } from '../types';

// ── Scroll detection ──────────────────────────────────────────────────────────
function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [threshold]);
  return scrolled;
}

// ── Fade-in on scroll ─────────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }
      },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const FADE: React.CSSProperties = {
  opacity: 0,
  transform: 'translateY(24px)',
  transition: 'opacity 0.55s ease, transform 0.55s ease',
};

// ── Platform features (3 clear value props) ───────────────────────────────────
const FEATURES = [
  {
    Icon: Calendar,
    accent: '#6366f1',
    bg: 'rgba(99,102,241,0.08)',
    title: 'Discover & Register',
    desc: 'Browse hackathons, seminars, workshops, and cultural events. Register in one click and get an instant confirmation.',
  },
  {
    Icon: QrCode,
    accent: '#0ea5e9',
    bg: 'rgba(14,165,233,0.08)',
    title: 'QR Attendance',
    desc: 'Show your unique QR code at the venue. Attendance is marked instantly — no manual rolls, no queues.',
  },
  {
    Icon: Award,
    accent: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    title: 'Certificates',
    desc: 'Attended an event? Download a verified certificate straight from your dashboard.',
  },
  {
    Icon: Bell,
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    title: 'Smart Reminders',
    desc: 'Automated email reminders 24 hours before every event you registered for. Never forget.',
  },
  {
    Icon: Users,
    accent: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    title: 'Organizer Dashboard',
    desc: 'Create events, track registrations, manage waitlists, and scan attendance — all in one place.',
  },
  {
    Icon: Zap,
    accent: '#ec4899',
    bg: 'rgba(236,72,153,0.08)',
    title: 'Real-time Updates',
    desc: 'Live notifications when new events are posted. Stay up to date without refreshing.',
  },
];

// ── Event image fallbacks ─────────────────────────────────────────────────────
const FALLBACK_IMGS = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600',
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const featRef = useFadeIn();
  const eventsRef = useFadeIn();
  const ctaRef = useFadeIn();

  // Auth state — read from localStorage (same pattern as the rest of the app)
  const token = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');
  const isLoggedIn = Boolean(token && storedUser);
  let userRole: string | null = null;
  if (storedUser) {
    try { userRole = JSON.parse(storedUser).role ?? null; } catch { localStorage.removeItem('user'); }
  }

  // Fetch real upcoming events
  useEffect(() => {
    api.get('/events')
      .then(res => setEvents(Array.isArray(res.data) ? res.data.slice(0, 3) : []))
      .catch(() => {});
  }, []);

  // "Host an Event" routing:
  // - already logged-in admin → admin dashboard
  // - logged-in non-admin → signup (they'll choose Admin/Organizer role)
  // - not logged in → signup
  const handleHostEvent = () => {
    if (isLoggedIn && userRole === 'admin') {
      navigate('/admin');
    } else {
      navigate('/signup');
    }
  };

  // "Browse Events" routing:
  // - logged-in non-admin → user dashboard
  // - anyone else → login
  const handleBrowseEvents = () => {
    if (isLoggedIn && userRole !== 'admin') navigate('/user');
    else navigate('/login');
  };

  return (
    <div style={{ overflowX: 'hidden', background: 'var(--bg)' }}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
      <nav className={`land-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="app-container land-nav-inner">
          {/* Logo */}
          <Link to="/" className="land-nav-logo">
            <span style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#4f46e5,#8b5cf6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={15} color="#fff" fill="#fff" />
            </span>
            <span>Campus</span>EventFinder
          </Link>

          {/* Desktop nav — minimal: Events | Sign In | Host an Event */}
          <div className="land-nav-links" style={{ gap: 6 }}>
            <button
              type="button"
              onClick={() => document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' })}
              className="land-nav-link"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Events
            </button>
            {isLoggedIn ? (
              <button
                type="button"
                className="land-nav-link"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={() => navigate(userRole === 'admin' ? '/admin' : '/user')}
              >
                Dashboard
              </button>
            ) : (
              <Link to="/login" className="land-nav-link">Sign In</Link>
            )}
            <button
              type="button"
              className="land-nav-cta"
              onClick={handleHostEvent}
            >
              Host an Event <ArrowRight size={13} style={{ verticalAlign: 'middle', marginLeft: 3 }} />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: 4 }}
            className="land-mobile-toggle"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" onClick={() => { document.getElementById('events')?.scrollIntoView({ behavior: 'smooth' }); setMobileOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left', fontWeight: 500, fontSize: '0.95rem', padding: '6px 0' }}>
              Events
            </button>
            {isLoggedIn ? (
              <button type="button" onClick={() => { navigate(userRole === 'admin' ? '/admin' : '/user'); setMobileOpen(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left', fontWeight: 500, fontSize: '0.95rem', padding: '6px 0' }}>
                Dashboard
              </button>
            ) : (
              <Link to="/login" onClick={() => setMobileOpen(false)} style={{ color: 'var(--text)', fontWeight: 500, fontSize: '0.95rem', padding: '6px 0', textDecoration: 'none' }}>
                Sign In
              </Link>
            )}
            <button type="button" onClick={() => { handleHostEvent(); setMobileOpen(false); }} className="btn btn-gradient" style={{ padding: '10px 16px', fontSize: '0.9rem', marginTop: 4 }}>
              Host an Event
            </button>
          </div>
        )}
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="land-hero">
        <div className="land-hero-bg" />
        <div className="land-hero-glow" />
        <div className="land-hero-glow2" />

        <div className="app-container land-hero-content">
          <div className="land-hero-copy">
            <div className="land-hero-badge">
              <Zap size={12} />
              CAMPUS EVENTS, MADE SIMPLE
            </div>

            <h1 className="land-hero-title">
              Discover events. Register easily. Manage everything in one place.
            </h1>

            <p className="land-hero-sub">
              Find college events that match your interests, register in a few clicks, and stay updated. Organizers can create events, manage registrations, and track attendance from one simple platform.
            </p>

            <div className="land-hero-actions">
              <button
                type="button"
                className="btn btn-gradient"
                style={{ padding: '13px 28px', fontSize: '0.97rem', boxShadow: '0 6px 20px rgba(99,102,241,0.4)' }}
                onClick={handleBrowseEvents}
              >
                Browse Events <ArrowRight size={15} />
              </button>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '13px 28px', fontSize: '0.97rem' }}
                onClick={handleHostEvent}
              >
                Host an Event <ArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Honest, minimal stats — just a few context lines, no fake numbers */}
          <div className="land-hero-stats">
            {[
              ['QR', 'Attendance'],
              ['Auto', 'Certificates'],
              ['Live', 'Notifications'],
              ['Free', 'To Join'],
            ].map(([n, l]) => (
              <div key={l} className="land-stat">
                <div className="land-stat-num" style={{ fontSize: '1.1rem', letterSpacing: 0 }}>{n}</div>
                <div className="land-stat-label">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="land-features" id="features" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="app-container">
          <p className="land-section-label">What you get</p>
          <h2 className="land-section-title">Built for campus life</h2>
          <p className="land-section-sub">
            Simple for students. Powerful for organizers.
          </p>
          <div ref={featRef} className="land-features-grid" style={FADE}>
            {FEATURES.map(f => (
              <div key={f.title} className="land-feature-card">
                <div className="land-feature-icon" style={{ background: f.bg, border: `1px solid ${f.accent}22` }}>
                  <f.Icon size={22} color={f.accent} />
                </div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE EVENTS ───────────────────────────────────────────────────── */}
      <section
        id="events"
        style={{ padding: '72px 0', background: 'var(--surface)' }}
      >
        <div className="app-container">
          <p className="land-section-label">Upcoming</p>
          <h2 className="land-section-title">Events on the platform</h2>
          <p className="land-section-sub">
            {events.length > 0
              ? 'Real events posted by organizers. Sign in to register.'
              : 'Events will appear here once organizers post them.'}
          </p>

          <div ref={eventsRef} className="land-event-grid" style={{ ...FADE, marginTop: 36 }}>
            {(events.length > 0
              ? events
              : ([
                  { _id: 'p1', title: 'Hackathon', description: 'Build something new in 24 hours with your team.', type: 'hackathon', date: new Date().toISOString(), time: '', registrationDeadline: '', location: 'College Auditorium' },
                  { _id: 'p2', title: 'Tech Seminar', description: 'Explore the latest in AI, ML, and cloud computing.', type: 'tech', date: new Date().toISOString(), time: '', registrationDeadline: '', location: 'Seminar Hall' },
                  { _id: 'p3', title: 'Cultural Fest', description: 'Performances, food stalls, and creative showcases.', type: 'other', date: new Date().toISOString(), time: '', registrationDeadline: '', location: 'Open Ground' },
                ] as EventItem[])
            ).map((ev, i) => (
              <div key={ev._id} className="land-event-card">
                <img
                  src={FALLBACK_IMGS[i % 3]}
                  alt={ev.title}
                  className="land-event-img"
                  style={{ filter: 'brightness(0.88)' }}
                  onError={e => { (e.target as HTMLImageElement).src = FALLBACK_IMGS[0]; }}
                />
                <div className="land-event-body">
                  <span className="land-event-tag">{ev.type}</span>
                  <h4>{ev.title}</h4>
                  <p>{(ev.description ?? '').slice(0, 88)}{(ev.description?.length ?? 0) > 88 ? '…' : ''}</p>
                  <div className="land-event-meta">
                    <span>
                      <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                      {new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span>
                      <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                      {ev.location}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-gradient full-width"
                    style={{ fontSize: '0.85rem', padding: '10px', marginTop: 4 }}
                    onClick={handleBrowseEvents}
                  >
                    {isLoggedIn && userRole !== 'admin' ? 'Go to Dashboard' : 'Sign In to Register'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {events.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 36 }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '12px 28px', fontSize: '0.92rem' }}
                onClick={handleBrowseEvents}
              >
                View All Events <ArrowRight size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── HOST AN EVENT CTA STRIP ────────────────────────────────────────── */}
      <section
        ref={ctaRef}
        style={{
          ...FADE,
          padding: '64px 0',
          background: 'linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#1e1b4b 100%)',
        }}
      >
        <div className="app-container" style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Organising a campus event?
          </h2>
          <p style={{ margin: '0 0 28px', color: 'rgba(255,255,255,0.72)', fontSize: '1rem', maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}>
            Create your organizer account, get approved, and start posting events with full attendance and certificate management.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleHostEvent}
              style={{ padding: '13px 28px', borderRadius: 10, background: '#fff', color: '#4f46e5', fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)'; }}
            >
              Host an Event ↗
            </button>
            {!isLoggedIn && (
              <Link
                to="/login"
                style={{ padding: '13px 28px', borderRadius: 10, background: 'transparent', color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.95rem', border: '1px solid rgba(255,255,255,0.3)', textDecoration: 'none', display: 'inline-block', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="land-footer">
        <div className="app-container">
          <div className="land-footer-grid">
            <div>
              <p className="land-footer-brand">
                <Zap size={13} style={{ verticalAlign: 'middle', marginRight: 4, color: '#818cf8' }} />
                CampusEventFinder
              </p>
              <p className="land-footer-desc">
                Discover, register, and manage campus events. Built for students and organizers.
              </p>
            </div>
            <div className="land-footer-col">
              <h5>Platform</h5>
              <Link to="/login">Sign In</Link>
              <Link to="/signup">Create Account</Link>
              <button type="button" onClick={handleHostEvent} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', color: 'inherit', fontSize: 'inherit' }}>
                Host an Event
              </button>
            </div>
            <div className="land-footer-col">
              <h5>Account</h5>
              <Link to="/signup">Student Signup</Link>
              <Link to="/forgot-password">Reset Password</Link>
              <button type="button" onClick={handleHostEvent} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', color: 'inherit', fontSize: 'inherit' }}>
                Organizer Signup
              </button>
            </div>
          </div>
          <div className="land-footer-bottom">
            <span>© {new Date().getFullYear()} CampusEventFinder. All rights reserved.</span>
            <span>Made for campus communities</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

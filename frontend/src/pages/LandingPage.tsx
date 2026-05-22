import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import type { EventItem } from "../types";

// ── tiny hook: detect scroll for navbar style ──────────────────────────────
function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

// ── tiny hook: fade-in on scroll ───────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.style.opacity = "1"; el.style.transform = "translateY(0)"; } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const FEATURES = [
  { icon: "🎯", bg: "#eef2ff", title: "Discover Events", desc: "Browse hackathons, seminars, tech talks, and more — all in one place." },
  { icon: "⚡", bg: "#fef3c7", title: "Instant Registration", desc: "Register for events in seconds. Get confirmation emails automatically." },
  { icon: "🔔", bg: "#f0fdf4", title: "Smart Reminders", desc: "Never miss an event. Automated reminders 24 hours before it starts." },
  { icon: "🛡️", bg: "#fdf4ff", title: "Admin Control", desc: "Admins create and manage their own events with full ownership control." },
  { icon: "📊", bg: "#fff7ed", title: "Registration Insights", desc: "Admins can view who registered, track attendance, and manage lists." },
  { icon: "📱", bg: "#f0f9ff", title: "Works Everywhere", desc: "Fully responsive — use it on desktop, tablet, or mobile seamlessly." },
];

const EVENT_IMAGES = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600",
];

export default function LandingPage() {
  const navigate = useNavigate();
  const scrolled  = useScrolled();
  const [events, setEvents] = useState<EventItem[]>([]);

  const featRef   = useFadeIn();
  const eventsRef = useFadeIn();
  const ctaRef    = useFadeIn();

  useEffect(() => {
    axios.get("http://127.0.0.1:5000/api/events")
      .then((res) => setEvents(Array.isArray(res.data) ? res.data.slice(0, 3) : []))
      .catch(() => {/* silently ignore if backend offline */});
  }, []);

  const token      = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");
  const isLoggedIn = Boolean(token && storedUser);
  let userRole: string | null = null;
  if (storedUser) {
    try { userRole = JSON.parse(storedUser).role ?? null; }
    catch { localStorage.removeItem("user"); }
  }

  return (
    <div style={{ overflowX: "hidden" }}>

      {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
      <nav className={`land-nav${scrolled ? " scrolled" : ""}`}>
        <div className="app-container land-nav-inner">
          <Link to="/" className="land-nav-logo">
            🎓 <span>Campus</span>EventFinder
          </Link>
          <div className="land-nav-links">
            <a href="#features" className="land-nav-link">Features</a>
            <a href="#events"   className="land-nav-link">Events</a>
            <Link to="/login"   className="land-nav-link">Login</Link>
            <Link to="/signup"  className="land-nav-cta">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="land-hero">
        <div className="land-hero-bg" />
        <div className="land-hero-glow" />
        <div className="land-hero-glow2" />
        <div className="app-container land-hero-content">
          <div className="land-hero-badge">✨ Your Campus. Your Events.</div>
          <h1 className="land-hero-title">
            Discover &amp; Manage<br />Campus Events
          </h1>
          <p className="land-hero-sub">
            The all-in-one platform for students to find events and admins to manage them —
            with instant registration, smart reminders, and beautiful dashboards.
          </p>
          <div className="land-hero-actions">
            <Link to="/signup" className="btn btn-gradient" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Get Started Free →
            </Link>
            <Link to="/login" className="btn btn-outline" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Sign In
            </Link>
          </div>
          <div className="land-hero-stats">
            <div className="land-stat">
              <div className="land-stat-num">500+</div>
              <div className="land-stat-label">Events Hosted</div>
            </div>
            <div className="land-stat">
              <div className="land-stat-num">2k+</div>
              <div className="land-stat-label">Students Registered</div>
            </div>
            <div className="land-stat">
              <div className="land-stat-num">50+</div>
              <div className="land-stat-label">Active Admins</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────── */}
      <section className="land-features" id="features">
        <div className="app-container">
          <p className="land-section-label">Why Choose Us</p>
          <h2 className="land-section-title">Everything you need, nothing you don't</h2>
          <p className="land-section-sub">
            Built for campus life — simple for students, powerful for admins.
          </p>
          <div
            ref={featRef}
            className="land-features-grid"
            style={{ opacity: 0, transform: "translateY(32px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
          >
            {FEATURES.map((f) => (
              <div key={f.title} className="land-feature-card">
                <div className="land-feature-icon" style={{ background: f.bg }}>{f.icon}</div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EVENTS PREVIEW ─────────────────────────────────────────────── */}
      <section className="land-events" id="events">
        <div className="app-container">
          <p className="land-section-label">Live Events</p>
          <h2 className="land-section-title">Upcoming on Campus</h2>
          <p className="land-section-sub">
            {events.length > 0
              ? "Real events from the platform — register to join."
              : "Events will appear here once admins post them."}
          </p>
          <div
            ref={eventsRef}
            className="land-event-grid"
            style={{ opacity: 0, transform: "translateY(32px)", transition: "opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s" }}
          >
            {events.length > 0
              ? events.map((ev, i) => (
                  <div key={ev._id} className="land-event-card">
                    <img
                      src={EVENT_IMAGES[i % EVENT_IMAGES.length]}
                      alt={ev.title}
                      className="land-event-img"
                    />
                    <div className="land-event-body">
                      <span className="land-event-tag">{ev.type}</span>
                      <h4>{ev.title}</h4>
                      <p>{ev.description?.slice(0, 90)}{ev.description?.length > 90 ? "…" : ""}</p>
                      <div className="land-event-meta">
                        <span>📅 {new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span>📍 {ev.location}</span>
                      </div>
                      <button
                        type="button"
                        className="btn btn-gradient full-width"
                        style={{ fontSize: "0.88rem", padding: "10px" }}
                        onClick={() => navigate(isLoggedIn && userRole !== "admin" ? "/user" : "/login")}
                      >
                        {isLoggedIn && userRole !== "admin" ? "Register Now" : "Login to Register"}
                      </button>
                    </div>
                  </div>
                ))
              : /* placeholder cards when no events */
                [0, 1, 2].map((i) => (
                  <div key={i} className="land-event-card">
                    <img src={EVENT_IMAGES[i]} alt="Event" className="land-event-img" />
                    <div className="land-event-body">
                      <span className="land-event-tag">Coming Soon</span>
                      <h4>Event #{i + 1}</h4>
                      <p>Events posted by admins will appear here. Sign up to stay notified.</p>
                      <div className="land-event-meta">
                        <span>📅 TBA</span>
                        <span>📍 Campus</span>
                      </div>
                      <Link to="/signup" className="btn btn-gradient full-width" style={{ fontSize: "0.88rem", padding: "10px" }}>
                        Sign Up to Explore
                      </Link>
                    </div>
                  </div>
                ))
            }
          </div>
          <div className="land-events-cta">
            <Link to="/login" className="btn btn-gradient" style={{ padding: "13px 32px" }}>
              View All Events →
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────────────────────── */}
      <section className="land-cta">
        <div
          ref={ctaRef}
          className="land-cta-inner app-container"
          style={{ opacity: 0, transform: "translateY(24px)", transition: "opacity 0.6s ease, transform 0.6s ease" }}
        >
          <h2>Ready to never miss an event?</h2>
          <p>Join thousands of students already using Campus Event Finder.</p>
          <div className="land-cta-btns">
            <Link to="/signup" className="btn btn-white" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Create Free Account
            </Link>
            <Link to="/login" className="btn btn-ghost" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="land-footer">
        <div className="app-container">
          <div className="land-footer-grid">
            <div>
              <p className="land-footer-brand">🎓 CampusEventFinder</p>
              <p className="land-footer-desc">
                The modern platform for discovering, registering, and managing campus events.
                Built for students and admins alike.
              </p>
            </div>
            <div className="land-footer-col">
              <h5>Platform</h5>
              <Link to="/login">Login</Link>
              <Link to="/signup">Sign Up</Link>
              <a href="#features">Features</a>
              <a href="#events">Events</a>
            </div>
            <div className="land-footer-col">
              <h5>Support</h5>
              <a href="#">Help Center</a>
              <a href="#">Contact Us</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>
          <div className="land-footer-bottom">
            <span>© {new Date().getFullYear()} CampusEventFinder. All rights reserved.</span>
            <span>Made with ❤️ for campus communities</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

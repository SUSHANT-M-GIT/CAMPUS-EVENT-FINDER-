import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Search, Zap, Bell, ShieldCheck, BarChart2, Smartphone,
  UserPlus, CalendarSearch, ClipboardCheck, Award,
  ArrowRight, LogIn, ChevronRight, Calendar, MapPin, Heart,
} from "lucide-react";
import type { EventItem } from "../types";

function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

const FEATURES = [
  { Icon: Search,       bg: "linear-gradient(135deg,#eef2ff,#e0e7ff)", iconColor: "#4f46e5", title: "Discover Events",      desc: "Browse hackathons, seminars, tech talks, and more — all in one place." },
  { Icon: Zap,          bg: "linear-gradient(135deg,#fffbeb,#fef3c7)", iconColor: "#d97706", title: "Instant Registration",  desc: "Register for events in seconds. Get confirmation emails automatically." },
  { Icon: Bell,         bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)", iconColor: "#16a34a", title: "Smart Reminders",      desc: "Never miss an event. Automated reminders 24 hours before it starts." },
  { Icon: ShieldCheck,  bg: "linear-gradient(135deg,#fdf4ff,#f3e8ff)", iconColor: "#9333ea", title: "Admin Control",        desc: "Admins create and manage their own events with full ownership control." },
  { Icon: BarChart2,    bg: "linear-gradient(135deg,#fff7ed,#ffedd5)", iconColor: "#ea580c", title: "Analytics & Insights", desc: "Track registrations, attendance, revenue and generate certificates." },
  { Icon: Smartphone,   bg: "linear-gradient(135deg,#f0f9ff,#e0f2fe)", iconColor: "#0284c7", title: "Works Everywhere",     desc: "Fully responsive — use it on desktop, tablet, or mobile seamlessly." },
];

const HOW_IT_WORKS = [
  { step: "01", Icon: UserPlus,       title: "Create Account", desc: "Sign up with your institutional email in under 30 seconds." },
  { step: "02", Icon: CalendarSearch, title: "Browse Events",  desc: "Search and filter events by category, date, or keyword." },
  { step: "03", Icon: ClipboardCheck, title: "Register",       desc: "One-click registration with instant email confirmation." },
  { step: "04", Icon: Award,          title: "Attend & Earn",  desc: "Show your QR at the venue and download your certificate." },
];

const EVENT_IMAGES = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600",
];

export default function LandingPage() {
  const navigate  = useNavigate();
  const scrolled  = useScrolled();
  const [events, setEvents] = useState<EventItem[]>([]);

  const featRef   = useFadeIn();
  const howRef    = useFadeIn();
  const eventsRef = useFadeIn();
  const ctaRef    = useFadeIn();

  useEffect(() => {
    axios.get("http://127.0.0.1:5000/api/events")
      .then(res => setEvents(Array.isArray(res.data) ? res.data.slice(0, 3) : []))
      .catch(() => {});
  }, []);

  const token      = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");
  const isLoggedIn = Boolean(token && storedUser);
  let userRole: string | null = null;
  if (storedUser) {
    try { userRole = JSON.parse(storedUser).role ?? null; }
    catch { localStorage.removeItem("user"); }
  }

  const fadeStyle: React.CSSProperties = {
    opacity: 0,
    transform: "translateY(28px)",
    transition: "opacity 0.6s ease, transform 0.6s ease",
  };

  return (
    <div style={{ overflowX: "hidden" }}>

      {/* NAVBAR */}
      <nav className={`land-nav${scrolled ? " scrolled" : ""}`}>
        <div className="app-container land-nav-inner">
          <Link to="/" className="land-nav-logo">
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#4f46e5,#8b5cf6)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
              <Zap size={16} color="#fff" fill="#fff" />
            </span>
            <span>Campus</span>EventFinder
          </Link>
          <div className="land-nav-links">
            <a href="#features" className="land-nav-link">Features</a>
            <a href="#how"      className="land-nav-link">How it works</a>
            <a href="#events"   className="land-nav-link">Events</a>
            <Link to="/login"   className="land-nav-link">Login</Link>
            <Link to="/signup"  className="land-nav-cta">Get Started <ArrowRight size={14} style={{ verticalAlign: "middle" }} /></Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="land-hero">
        <div className="land-hero-bg" />
        <div className="land-hero-glow" />
        <div className="land-hero-glow2" />
        <div className="app-container land-hero-content">
          <div className="land-hero-badge"><Zap size={13} style={{ verticalAlign: "middle", marginRight: 5 }} /> The #1 Campus Event Platform</div>
          <h1 className="land-hero-title">
            Discover &amp; Manage<br />Campus Events
          </h1>
          <p className="land-hero-sub">
            The all-in-one platform for students to find events and admins to manage them 
            with instant registration, smart reminders, QR attendance, and beautiful dashboards.
          </p>
          <div className="land-hero-actions">
            <Link to="/signup" className="btn btn-gradient" style={{ padding: "14px 32px", fontSize: "1rem", boxShadow: "0 8px 24px rgba(99,102,241,0.5)" }}>
              Get Started Free <ArrowRight size={16} style={{ verticalAlign: "middle", marginLeft: 4 }} />
            </Link>
            <Link to="/login" className="btn btn-outline" style={{ padding: "14px 32px", fontSize: "1rem" }}>
              Sign In
            </Link>
          </div>
          <div className="land-hero-stats">
            {[["500+","Events Hosted"],["2k+","Students"],["50+","Admins"],["99%","Satisfaction"]].map(([n, l]) => (
              <div key={l} className="land-stat">
                <div className="land-stat-num">{n}</div>
                <div className="land-stat-label">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="land-features" id="features">
        <div className="app-container">
          <p className="land-section-label">Why Choose Us</p>
          <h2 className="land-section-title">Everything you need, nothing you don't</h2>
          <p className="land-section-sub">Built for campus life  simple for students, powerful for admins.</p>
          <div ref={featRef} className="land-features-grid" style={fadeStyle}>
            {FEATURES.map(f => (
              <div key={f.title} className="land-feature-card">
                <div className="land-feature-icon" style={{ background: f.bg }}>
                  <f.Icon size={24} color={f.iconColor} />
                </div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: "100px 0", background: "linear-gradient(135deg,#0f0c29 0%,#302b63 100%)", color: "#fff" }}>
        <div className="app-container">
          <p className="land-section-label" style={{ color: "#a5b4fc" }}>Simple Process</p>
          <h2 className="land-section-title" style={{ color: "#fff" }}>From signup to certificate in 4 steps</h2>
          <div ref={howRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 24, marginTop: 48, ...fadeStyle }}>
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step}
                style={{ textAlign: "center", padding: "32px 24px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(99,102,241,0.25)", transition: "transform 0.25s, box-shadow 0.25s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-6px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 40px rgba(0,0,0,0.3)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
              >
                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "#818cf8", letterSpacing: "0.1em", marginBottom: 16 }}>{s.step}</div>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <s.Icon size={26} color="#fff" />
                </div>
                <h4 style={{ margin: "0 0 8px", color: "#fff", fontSize: "1rem" }}>{s.title}</h4>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: "0.875rem", lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EVENTS PREVIEW */}
      <section className="land-events" id="events">
        <div className="app-container">
          <p className="land-section-label">Live Events</p>
          <h2 className="land-section-title">Upcoming on Campus</h2>
          <p className="land-section-sub">
            {events.length > 0 ? "Real events from the platform  register to join." : "Events will appear here once admins post them."}
          </p>
          <div ref={eventsRef} className="land-event-grid" style={fadeStyle}>
            {(events.length > 0
              ? events
              : [
                  { _id: "1", title: "Hackathon 2025",   description: "Build something amazing in 24 hours with your team.",        type: "hackathon", date: new Date().toISOString(), time: "", registrationDeadline: "", location: "Campus" },
                  { _id: "2", title: "Tech Seminar",     description: "Learn about the latest trends in AI and machine learning.",    type: "tech",      date: new Date().toISOString(), time: "", registrationDeadline: "", location: "Campus" },
                  { _id: "3", title: "Cultural Night",   description: "Celebrate diversity with performances, food, and fun.",        type: "other",     date: new Date().toISOString(), time: "", registrationDeadline: "", location: "Campus" },
                ] as EventItem[]
            ).map((ev, i) => (
              <div key={ev._id} className="land-event-card">
                <img src={EVENT_IMAGES[i % 3]} alt={ev.title} className="land-event-img" style={{ filter: "brightness(0.9)" }} />
                <div className="land-event-body">
                  <span className="land-event-tag">{ev.type}</span>
                  <h4>{ev.title}</h4>
                  <p>{(ev.description ?? "").slice(0, 90)}{(ev.description?.length ?? 0) > 90 ? "…" : ""}</p>
                  <div className="land-event-meta">
                    <span><Calendar size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    <span><MapPin size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />{ev.location}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-gradient full-width"
                    style={{ fontSize: "0.875rem", padding: "10px" }}
                    onClick={() => navigate(isLoggedIn && userRole !== "admin" ? "/user" : "/login")}
                  >
                    {events.length > 0
                      ? (isLoggedIn && userRole !== "admin" ? <>Register Now <ChevronRight size={14} style={{ verticalAlign: "middle" }} /></> : <><LogIn size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />Login to Register</>)
                      : <>Sign Up to Explore <ArrowRight size={14} style={{ verticalAlign: "middle" }} /></>}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="land-events-cta">
            <Link to="/login" className="btn btn-gradient" style={{ padding: "13px 32px" }}>
              View All Events <ArrowRight size={15} style={{ verticalAlign: "middle", marginLeft: 4 }} />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="land-cta">
        <div ref={ctaRef} className="land-cta-inner app-container" style={fadeStyle}>
          <h2>Ready to never miss an event?</h2>
          <p>Join thousands of students already using Campus Event Finder.</p>
          <div className="land-cta-btns">
            <Link to="/signup" className="btn btn-white" style={{ padding: "14px 32px", fontSize: "1rem" }}>Create Free Account</Link>
            <Link to="/login"  className="btn btn-ghost" style={{ padding: "14px 32px", fontSize: "1rem" }}>Sign In</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="land-footer">
        <div className="app-container">
          <div className="land-footer-grid">
            <div>
              <p className="land-footer-brand"><Zap size={14} style={{ verticalAlign: "middle", marginRight: 5, color: "#818cf8" }} /> CampusEventFinder</p>
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
            <span>Made with <Heart size={12} style={{ verticalAlign: "middle", color: "#f43f5e", fill: "#f43f5e" }} /> for campus communities</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

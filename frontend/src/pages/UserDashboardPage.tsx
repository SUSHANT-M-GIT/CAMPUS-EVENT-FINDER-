import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ticket, Calendar, CheckCircle2, Clock, MapPin, GraduationCap, Star, Share2, CreditCard, AlertCircle, CheckCircle, Hourglass, Award } from "lucide-react";
import AppNavbar from "../components/AppNavbar";
import Alert from "../components/Alert";
import PaymentModal from "../components/PaymentModal";
import EventCarousel from "../components/EventCarousel";
import { SkeletonCard } from "../components/SkeletonCard";
import EmptyState from "../components/EmptyState";
import { useAuth } from "../context/AuthContext";
import { getMyRegistrations, registerForEvent, cancelRegistration } from "../services/registrationService";
import { submitFeedback, getMyFeedback } from "../services/feedbackService";
import { getComments, addComment, deleteComment } from "../services/commentService";
import axios from "axios";
import api from "../services/api";
import type { EventItem, RegistrationItem, CommentItem } from "../types";

// Derive backend base URL for serving static assets (banners, screenshots)
const API_BASE = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

export default function UserDashboardPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents]               = useState<EventItem[]>([]);
  const [similarEvents, setSimilarEvents] = useState<EventItem[]>([]);
  const [noResultsMsg, setNoResultsMsg]   = useState("");
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [feedback, setFeedback]           = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [registerForm, setRegisterForm]   = useState({ name: "", collegeId: "", department: "", customDepartment: "", company: "", designation: "" });
  const [cancellingId, setCancellingId]   = useState<string | null>(null);

  // Feedback modal state
  const [feedbackEventId, setFeedbackEventId]       = useState<string | null>(null);
  const [feedbackEventTitle, setFeedbackEventTitle] = useState("");
  const [starRating, setStarRating]                 = useState(0);
  const [starHover, setStarHover]                   = useState(0);
  const [feedbackComment, setFeedbackComment]       = useState("");
  const [feedbackLoading, setFeedbackLoading]       = useState(false);
  const [submittedFeedbacks, setSubmittedFeedbacks] = useState<Set<string>>(new Set());

  // Search & filter state
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchEvents = useCallback(async (q?: string, t?: string) => {
    try {
      setEventsLoading(true);
      const params = new URLSearchParams();
      if (q?.trim()) params.set("search", q.trim());
      if (t)         params.set("type", t);
      const url = `${API_BASE}/api/events${params.toString() ? "?" + params.toString() : ""}`;
      const res = await axios.get(url);
      if (res.data && !Array.isArray(res.data) && res.data.similarEvents) {
        setEvents([]);
        setSimilarEvents(Array.isArray(res.data.similarEvents) ? res.data.similarEvents : []);
        setNoResultsMsg(res.data.message || "No exact matches found.");
      } else {
        setEvents(Array.isArray(res.data) ? res.data : []);
        setSimilarEvents([]);
        setNoResultsMsg("");
      }
    } catch (err) {
      console.error("[UserDashboard] fetchEvents failed:", err);
      setFeedback({ type: "error", message: "Could not load events." });
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadRegistrations = useCallback(async () => {
    try {
      const data = await getMyRegistrations();
      setRegistrations(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void fetchEvents();
    void loadRegistrations();
    const onStorage = (e: StorageEvent) => { if (e.key === "events_last_updated") void fetchEvents(); };
    window.addEventListener("storage", onStorage);
    // Close share popover on outside click  removed (share is now direct copy)
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchEvents, loadRegistrations]);

  // Map eventId  registration for quick lookup
  const registrationByEventId = useMemo(() => {
    const map = new Map<string, RegistrationItem>();
    registrations.forEach(r => {
      const id = typeof r.eventId === "string" ? r.eventId : r.eventId?._id;
      if (id) map.set(id, r);
    });
    return map;
  }, [registrations]);

  const handleTypeChange = (t: string) => {
    setTypeFilter(t);
    void fetchEvents(search, t);
  };

  const handleClearSearch = () => {
    setSearchInput(""); setSearch(""); setTypeFilter("");
    void fetchEvents("", "");
  };

  const handleRegister = async (eventId: string) => {
    if (!registerForm.name || !registerForm.department) {
      setFeedback({ type: "error", message: "Please fill all registration details." });
      return;
    }
    // Students need college ID; professionals need designation
    if (user?.role === "professional") {
      if (!registerForm.designation?.trim()) {
        setFeedback({ type: "error", message: "Please enter your designation/role." });
        return;
      }
    } else {
      if (!registerForm.collegeId?.trim()) {
        setFeedback({ type: "error", message: "Please fill all registration details." });
        return;
      }
    }
    if (registerForm.department === "Others — Please specify below" && !registerForm.customDepartment.trim()) {
      setFeedback({ type: "error", message: "Please describe your role or field in the text box." });
      return;
    }
    try {
      const finalDepartment = registerForm.department === "Others — Please specify below"
        ? (registerForm.customDepartment.trim() || "Others")
        : registerForm.department;
      const response = await registerForEvent(eventId, { ...registerForm, department: finalDepartment, collegeName: user?.collegeName || "" });

      if (response.status === "confirmed" && !response.isPaid) {
        setEvents(prev => prev.map(ev =>
          ev._id === eventId ? { ...ev, registrationCount: (ev.registrationCount ?? 0) + 1 } : ev
        ));
      }

      await loadRegistrations();
      setTimeout(() => { void fetchEvents(); }, 500);
      setSelectedEventId(null);
      setRegisterForm({ name: "", collegeId: "", department: "", customDepartment: "", company: "", designation: "" });

      // If paid event  open payment modal immediately
      if (response.isPaid && response.registrationId) {
        const ev = events.find(e => e._id === eventId);
        if (ev) {
          setPaymentTarget({ registrationId: response.registrationId, event: ev });
        } else {
          setFeedback({ type: "success", message: response.msg });
        }
      } else {
        setFeedback({ type: "success", message: response.msg });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Registration failed." });
    }
  };

  // Payment modal state
  interface PaymentTarget { registrationId: string; event: EventItem; }
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Q&A state
  const [qaOpenId, setQaOpenId]           = useState<string | null>(null);
  const [comments, setComments]           = useState<Record<string, CommentItem[]>>({});
  const [qaLoading, setQaLoading]         = useState<string | null>(null);
  const [qaInput, setQaInput]             = useState("");
  const [replyingTo, setReplyingTo]       = useState<string | null>(null);
  const [replyInput, setReplyInput]       = useState("");
  const [qaSubmitting, setQaSubmitting]   = useState(false);

  const loadComments = async (eventId: string) => {
    setQaLoading(eventId);
    try {
      const data = await getComments(eventId);
      setComments(prev => ({ ...prev, [eventId]: data }));
    } catch { /* silent */ }
    finally { setQaLoading(null); }
  };

  const toggleQa = (eventId: string) => {
    if (qaOpenId === eventId) { setQaOpenId(null); return; }
    setQaOpenId(eventId);
    setQaInput(""); setReplyingTo(null); setReplyInput("");
    if (!comments[eventId]) void loadComments(eventId);
  };

  const handleAddComment = async (eventId: string, text: string, parentId?: string) => {
    if (!text.trim()) return;
    setQaSubmitting(true);
    try {
      await addComment(eventId, text.trim(), parentId);
      await loadComments(eventId);
      if (parentId) { setReplyingTo(null); setReplyInput(""); }
      else setQaInput("");
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Failed to post comment." });
    } finally { setQaSubmitting(false); }
  };

  const handleDeleteComment = async (commentId: string, eventId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteComment(commentId);
      await loadComments(eventId);
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Failed to delete." });
    }
  };

  const handleShare = async (event: EventItem) => {
    const url = `${window.location.origin}/events/${event._id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setFeedback({ type: "success", message: "Event link copied to clipboard! 📋" });
  };

  const handleCancel = async (eventId: string) => {
    setCancellingId(eventId);
    try {
      await cancelRegistration(eventId);
      setFeedback({ type: "success", message: "Registration cancelled." });
      await loadRegistrations();
      setTimeout(() => { void fetchEvents(); }, 500);
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Cancellation failed." });
    } finally {
      setCancellingId(null);
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const openFeedbackModal = async (eventId: string, title: string) => {
    try {
      const existing = await getMyFeedback(eventId);
      if (existing) {
        setSubmittedFeedbacks(prev => new Set([...prev, eventId]));
        setFeedback({ type: "error", message: "You have already submitted feedback for this event." });
        return;
      }
    } catch { /* proceed */ }
    setFeedbackEventId(eventId);
    setFeedbackEventTitle(title);
    setStarRating(0); setStarHover(0); setFeedbackComment("");
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackEventId || starRating === 0) {
      setFeedback({ type: "error", message: "Please select a star rating." });
      return;
    }
    setFeedbackLoading(true);
    try {
      await submitFeedback(feedbackEventId, { rating: starRating, comment: feedbackComment });
      setSubmittedFeedbacks(prev => new Set([...prev, feedbackEventId]));
      setFeedbackEventId(null);
      setFeedback({ type: "success", message: "Thank you for your feedback! 🎉" });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Failed to submit feedback." });
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <AppNavbar
        links={[
          { label: "Events", href: "#events" },
          { label: "My Registrations", href: "#registrations" },
          { label: "Logout", onClick: handleLogout },
        ]}
        showBell
        userName={user?.collegeName}
        userInitial={user?.collegeName?.charAt(0).toUpperCase() ?? "S"}
      />

      {/*  PREMIUM HERO BANNER  */}
      <div className="app-container">
        <section className="dashboard-banner" style={{ marginTop: 24 }}>
          <img src="https://images.unsplash.com/photo-1511578314322-379afb476865?w=1400" alt="Campus event" />
          <div className="dashboard-banner-overlay">
            {/* Welcome greeting */}
            <p style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
              👋 Welcome back
            </p>
            <h1 style={{ margin: "0 0 4px" }}>
              {user?.collegeName ? `${user.collegeName}` : "Student Dashboard"}
            </h1>
            <p style={{ margin: "0 0 20px", color: "rgba(255,255,255,0.75)", fontSize: "0.9rem" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>

            {/* Summary cards inside banner */}
            <div className="summary-grid">
              {(() => {
                const confirmed   = registrations.filter(r => r.status === "confirmed" || !r.status);
                const now         = new Date();
                const upcoming    = confirmed.filter(r => { const ev = r.eventId as EventItem; return ev?.date && new Date(ev.date) >= now; });
                const pendingPay  = registrations.filter(r => r.paymentStatus === "pending");
                const certs       = registrations.filter(r => r.attendanceStatus === "present" && (r.eventId as EventItem)?.certificatesEnabled);
                return [
                  { icon: "Cal", value: upcoming.length,   label: "Upcoming Events",     color: "#4f46e5" },
                  { icon: "Reg", value: confirmed.length,  label: "Registered",           color: "#8b5cf6" },
                  { icon: "Pay", value: pendingPay.length,  label: "Pending Payments",    color: "#f59e0b" },
                  { icon: "Cert", value: certs.length,      label: "Certificates Ready",  color: "#10b981" },
                ].map(s => (
                  <div key={s.label} className="summary-card">
                    <div className="summary-card-value" style={{ fontSize: "1.8rem", color: "#fff" }}>{s.value}</div>
                    <div className="summary-card-label">{s.label}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </section>
      </div>

      <main className="app-container dashboard-content">
        {feedback && <Alert type={feedback.type} message={feedback.message} />}

        {/*  EVENTS SECTION  */}
        <section id="events" className="dashboard-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <h3 style={{ margin: 0, color: "var(--gray-900)", fontSize: "1.2rem" }}>
              <Calendar size={16} style={{ verticalAlign: "middle", marginRight: 6, color: "#4f46e5" }} />Discover Events
            </h3>
            <span style={{ fontSize: "0.8rem", color: "var(--gray-400)", fontWeight: 500 }}>
              {events.length} event{events.length !== 1 ? "s" : ""} available
            </span>
          </div>

          {/* Live search bar */}
          <div style={{ marginBottom: 14 }}>
            <div className="search-bar" style={{ marginBottom: 12 }}>
              <span style={{ padding: "0 0 0 14px", color: "var(--gray-400)", fontSize: "1rem", flexShrink: 0, display: "flex", alignItems: "center" }}><MapPin size={15} /></span>
              <input
                value={searchInput}
                onChange={e => {
                  setSearchInput(e.target.value);
                  // Debounced live search
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                  searchTimerRef.current = setTimeout(() => {
                    setSearch(e.target.value);
                    void fetchEvents(e.target.value, typeFilter);
                  }, 300);
                }}
                placeholder="Search events, tags, locations"
                style={{ border: 0, background: "transparent", outline: "none", padding: "11px 10px", fontSize: "0.9rem", flex: 1, color: "var(--gray-800)" }}
              />
              {searchInput && (
                <button type="button" onClick={handleClearSearch}
                  style={{ padding: "0 14px", background: "none", border: 0, cursor: "pointer", color: "var(--gray-400)", fontSize: "1rem" }}>✕</button>
              )}
            </div>

            {/* Filter chips */}
            <div className="filter-chips">
              {[
                { label: "All", value: "" },
                { label: "Hackathon", value: "hackathon" },
                { label: "Tech", value: "tech" },
                { label: "Seminar", value: "seminar" },
                { label: "Games", value: "games" },
                { label: "Movie", value: "movie" },
                { label: "Other", value: "other" },
              ].map(f => (
                <button key={f.value} type="button"
                  className={`filter-chip${typeFilter === f.value ? " active" : ""}`}
                  onClick={() => handleTypeChange(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {noResultsMsg && (
            <div style={{ marginBottom: 16 }}>
            <p style={{ color: "var(--gray-500)", fontSize: "0.9rem", marginBottom: similarEvents.length ? 12 : 0 }}>ℹ️ {noResultsMsg}</p>
              {similarEvents.length > 0 && <p style={{ fontSize: "0.82rem", color: "var(--gray-400)", marginBottom: 12 }}>Similar events you might like:</p>}
            </div>
          )}

          {/* Featured carousel  show top 3 events */}
          {!searchInput && !typeFilter && events.length > 0 && !eventsLoading && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--brand-600)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Featured</p>
              <EventCarousel
                events={events.slice(0, 5)}
                onRegister={(id) => setSelectedEventId(id)}
              />
            </div>
          )}

          {/* Skeleton loading */}
          {eventsLoading && (
            <div className="event-grid stagger">
              {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!eventsLoading && (noResultsMsg ? similarEvents : events).length === 0 && (
            <EmptyState
              icon="*"
              title={searchInput ? "No events found" : "No events yet"}
              description={searchInput ? `No events match "${searchInput}". Try different keywords.` : "Events will appear here once admins post them. Check back soon!"}
              action={searchInput ? <button type="button" className="btn btn-ghost" onClick={handleClearSearch} style={{ fontSize: "0.875rem" }}>Clear search</button> : undefined}
            />
          )}

          {/* Event grid */}
          {!eventsLoading && (
          <div className="event-grid">
            {(noResultsMsg ? similarEvents : events).map((event) => {
              const myReg = registrationByEventId.get(event._id);
              const isFull = event.maxRegistrations != null && (event.registrationCount ?? 0) >= event.maxRegistrations;
              return (
                <article key={event._id} className="event-card">
                  {/* Image with overlay type badge */}
                  <div className="event-card-img-wrap">
                    <img
                      src={event.bannerImage
                        ? (event.bannerImage.startsWith("/uploads") || !event.bannerImage.startsWith("http")
                            ? `${API_BASE}${event.bannerImage}?v=${event._id?.slice(-6) ?? "1"}`
                            : event.bannerImage)
                        : "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600"}
                      alt={event.title}
                      style={{ width: "100%", height: 175, objectFit: "cover", display: "block" }}
                      onError={e => {
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600";
                      }}
                    />
                    {/* Type badge */}
                    <span style={{ position: "absolute", top: 10, left: 10, background: "rgba(79,70,229,0.88)", color: "#fff", borderRadius: 99, padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, textTransform: "capitalize", backdropFilter: "blur(4px)" }}>
                      {event.type}
                    </span>
                    {/* Paid badge */}
                    {event.isPaid && (
                      <span style={{ position: "absolute", top: 10, right: 10, background: "rgba(5,150,105,0.9)", color: "#fff", borderRadius: 99, padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, backdropFilter: "blur(4px)" }}>
                        {event.price}
                      </span>
                    )}
                    {isFull && (
                      <span style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(124,58,237,0.9)", color: "#fff", borderRadius: 99, padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700 }}>
                        Full
                      </span>
                    )}
                  </div>

                  <div className="event-card-body">
                    {/* Title */}
                    <h4 style={{ color: "var(--text)", fontSize: "1rem", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{event.title}</h4>

                    {/* Tags */}
                    {event.tags && event.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {event.tags.map(tag => (
                          <span key={tag} style={{ background: "rgba(108,99,255,0.15)", color: "#4f46e5", borderRadius: 99, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 600 }}>#{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    <p style={{ color: "var(--text-2)", fontSize: "0.86rem", lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{event.description}</p>

                    {/* Meta */}
                    <div style={{ display: "flex", gap: 12, fontSize: "0.78rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}> <strong style={{ color: "var(--text-2)" }}>{new Date(event.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}> <strong style={{ color: "var(--text-2)" }}>{event.location}</strong></span>
                    </div>

                    {/* Rating */}
                    {event.avgRating != null && event.avgRating > 0 && (
                      <div style={{ fontSize: "0.78rem", color: "#f59e0b", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} size={12} fill={i < Math.round(event.avgRating!) ? "#f59e0b" : "none"} color="#f59e0b" />
                        ))}
                        <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{event.avgRating!.toFixed(1)} ({event.feedbackCount})</span>
                      </div>
                    )}

                    {/* Capacity bar */}
                    {event.maxRegistrations != null && (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.73rem", marginBottom: 4 }}>
                          <span style={{ color: "var(--text-muted)" }}><strong style={{ color: "var(--text-2)" }}>{event.registrationCount ?? 0}</strong> registered</span>
                          <span style={{ color: isFull ? "#7c3aed" : "#6b7280", fontWeight: 600 }}>{isFull ? "Full" : `${event.maxRegistrations} max`}</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(108,99,255,0.12)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 99, transition: "width 0.5s ease",
                            width: `${Math.min(100, Math.round(((event.registrationCount ?? 0) / event.maxRegistrations) * 100))}%`,
                            background: isFull ? "linear-gradient(90deg,#7c3aed,#a855f7)" : "linear-gradient(90deg,#4f46e5,#818cf8)",
                          }} />
                        </div>
                        {isFull && !myReg && (
                          <p style={{ margin: "4px 0 0", fontSize: "0.73rem", color: "#7c3aed", fontWeight: 600 }}>⚠ Full — join waitlist below</p>
                        )}
                      </div>
                    )}

                    {/* Registration status / action buttons */}
                    {myReg ? (
                      <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                        {myReg.status === "waitlisted" ? (
                          <span style={{ background: "rgba(168,85,247,0.15)", color: "var(--secondary)", borderRadius: 8, padding: "5px 11px", fontSize: "0.78rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Clock size={12} /> Waitlist #{myReg.waitlistPosition}
                          </span>
                        ) : myReg.paymentStatus === "pending" ? (
                          <span style={{ background: "rgba(245,158,11,0.15)", color: "var(--warning)", borderRadius: 8, padding: "5px 11px", fontSize: "0.78rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><Hourglass size={12} /> Payment Pending</span>
                        ) : myReg.paymentStatus === "rejected" ? (
                          <span style={{ background: "rgba(239,68,68,0.15)", color: "var(--danger)", borderRadius: 8, padding: "5px 11px", fontSize: "0.78rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertCircle size={12} /> Payment Rejected</span>
                        ) : (
                          <span style={{ background: "rgba(34,197,94,0.15)", color: "var(--success)", borderRadius: 8, padding: "5px 11px", fontSize: "0.78rem", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle size={12} /> Registered</span>
                        )}

                        {myReg.paymentStatus === "pending" && !myReg.transactionId ? (
                          <button type="button" onClick={() => setPaymentTarget({ registrationId: myReg._id, event })}
                            style={{ background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", border: 0, borderRadius: 8, padding: "5px 11px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <CreditCard size={12} /> Pay Now
                          </button>
                        ) : myReg.paymentStatus === "rejected" ? (
                          <button type="button" onClick={() => setPaymentTarget({ registrationId: myReg._id, event })}
                            style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", border: 0, borderRadius: 8, padding: "5px 11px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <CreditCard size={12} /> Pay Again
                          </button>
                        ) : null}

                        {myReg.paymentStatus === "rejected" && myReg.paymentNote && (
                          <p style={{ width: "100%", margin: "2px 0 0", fontSize: "0.73rem", color: "#b91c1c" }}>Reason: {myReg.paymentNote}</p>
                        )}

                        {myReg.status !== "waitlisted" && myReg.paymentStatus !== "pending" && (
                          <button type="button" onClick={() => void handleCancel(event._id)} disabled={cancellingId === event._id}
                            style={{ background: "var(--surface-2)", color: "#dc2626", border: "1.5px solid #fca5a5", borderRadius: 8, padding: "5px 11px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                            {cancellingId === event._id ? "" : "Cancel"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <button type="button" onClick={() => setSelectedEventId(event._id)}
                        style={{
                          width: "100%", border: 0, borderRadius: 10, padding: "11px", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", color: "#fff",
                          background: isFull ? "linear-gradient(135deg,#7c3aed,#a855f7)" : event.isPaid ? "linear-gradient(135deg,#059669,#10b981)" : "linear-gradient(135deg,#4f46e5,#6366f1)",
                          boxShadow: isFull ? "0 4px 14px rgba(124,58,237,0.35)" : event.isPaid ? "0 4px 14px rgba(5,150,105,0.35)" : "0 4px 14px rgba(79,70,229,0.35)",
                          transition: "opacity 0.2s, transform 0.2s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
                      >
                        {isFull ? "Join Waitlist" : event.isPaid ? `Register · ₹${event.price}` : "Register Free"}
                      </button>
                    )}

                    {/* Share */}
                    <button type="button" onClick={() => void handleShare(event)} title="Copy event link"
                      style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: "0.82rem", cursor: "pointer", alignSelf: "flex-start", transition: "background 0.2s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#e0e7ff"; (e.currentTarget as HTMLButtonElement).style.color = "#4f46e5"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#f1f5f9"; (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
                    >
                      <Share2 size={13} style={{ verticalAlign: "middle", marginRight: 4 }} /> Share
                    </button>
                  </div>

                  {/*  Q&A panel  */}
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    <button
                      type="button"
                      onClick={() => toggleQa(event._id)}
                      style={{ width: "100%", background: "none", border: 0, padding: "10px 14px", cursor: "pointer", fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      💬 Q&A
                      {comments[event._id]?.length > 0 && (
                        <span style={{ background: "rgba(108,99,255,0.15)", color: "#4f46e5", borderRadius: 99, padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700 }}>
                          {comments[event._id].length}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: "0.7rem" }}>{qaOpenId === event._id ? "▲" : "▼"}</span>
                    </button>

                    {qaOpenId === event._id && (
                      <div style={{ padding: "0 14px 14px" }}>
                        {qaLoading === event._id ? (
                          <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", margin: "8px 0" }}>Loading</p>
                        ) : (
                          <>
                            {/* Comment list */}
                            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                              {(comments[event._id] ?? []).length === 0 && (
                                <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", margin: 0 }}>No questions yet. Be the first to ask!</p>
                              )}
                              {(comments[event._id] ?? []).map(c => {
                                const author = typeof c.userId === "object" ? c.userId : null;
                                const isAdmin = author?.role === "admin";
                                const isMe = author?._id === user?.id;
                                return (
                                  <div key={c._id}>
                                    {/* Top-level comment */}
                                    <div style={{ background: isAdmin ? "#f0fdf4" : "#f8fafc", borderRadius: 8, padding: "10px 12px", border: `1px solid ${isAdmin ? "#bbf7d0" : "#e2e8f0"}` }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                            <span style={{ fontWeight: 700, fontSize: "0.8rem", color: isAdmin ? "#166534" : "#334155" }}>
                                              {author?.name ?? "User"}
                                            </span>
                                            {isAdmin && (
                                              <span style={{ background: "rgba(34,197,94,0.15)", color: "var(--success)", borderRadius: 99, padding: "1px 6px", fontSize: "0.68rem", fontWeight: 700 }}>Admin</span>
                                            )}
                                            <span style={{ color: "var(--text-dim)", fontSize: "0.72rem" }}>
                                              {new Date(c.createdAt).toLocaleDateString()}
                                            </span>
                                          </div>
                                          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.5 }}>{c.text}</p>
                                        </div>
                                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                          {/* Students cannot reply  only the event admin can */}
                                          {isMe && (
                                            <button type="button" onClick={() => void handleDeleteComment(c._id, event._id)}
                                              style={{ background: "none", border: 0, color: "#ef4444", fontSize: "0.75rem", cursor: "pointer", padding: "2px 4px" }}></button>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Replies */}
                                    {c.replies?.length > 0 && (
                                      <div style={{ marginLeft: 16, marginTop: 6, display: "grid", gap: 6 }}>
                                        {c.replies.map(r => {
                                          const rAuthor = typeof r.userId === "object" ? r.userId : null;
                                          const rIsAdmin = rAuthor?.role === "admin";
                                          const rIsMe = rAuthor?._id === user?.id;
                                          return (
                                            <div key={r._id} style={{ background: rIsAdmin ? "#f0fdf4" : "#fff", borderRadius: 8, padding: "8px 12px", border: `1px solid ${rIsAdmin ? "#bbf7d0" : "#e2e8f0"}` }}>
                                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                <div>
                                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                                    <span style={{ fontWeight: 700, fontSize: "0.78rem", color: rIsAdmin ? "#166534" : "#334155" }}>{rAuthor?.name ?? "User"}</span>
                                                    {rIsAdmin && <span style={{ background: "rgba(34,197,94,0.15)", color: "var(--success)", borderRadius: 99, padding: "1px 6px", fontSize: "0.68rem", fontWeight: 700 }}>Admin</span>}
                                                    <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                                                  </div>
                                                  <p style={{ margin: 0, fontSize: "0.83rem", color: "var(--text-2)", lineHeight: 1.5 }}>{r.text}</p>
                                                </div>
                                                {rIsMe && (
                                                  <button type="button" onClick={() => void handleDeleteComment(r._id, event._id)}
                                                    style={{ background: "none", border: 0, color: "#ef4444", fontSize: "0.75rem", cursor: "pointer", padding: "2px 4px", flexShrink: 0 }}></button>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}

                                    {/* Reply input */}
                                    {replyingTo === c._id && (
                                      <div style={{ marginLeft: 16, marginTop: 6, display: "flex", gap: 6 }}>
                                        <input
                                          value={replyInput}
                                          onChange={e => setReplyInput(e.target.value)}
                                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAddComment(event._id, replyInput, c._id); } }}
                                          placeholder="Write a reply"
                                          style={{ flex: 1, border: "1px solid rgba(108,99,255,0.3)", borderRadius: 7, padding: "7px 10px", fontSize: "0.82rem", outline: "none" }}
                                        />
                                        <button type="button" onClick={() => void handleAddComment(event._id, replyInput, c._id)}
                                          disabled={qaSubmitting || !replyInput.trim()}
                                          style={{ background: "#4f46e5", color: "#fff", border: 0, borderRadius: 7, padding: "0 12px", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>
                                          Send
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* New question input */}
                            <div style={{ display: "flex", gap: 6 }}>
                              <input
                                value={qaInput}
                                onChange={e => setQaInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAddComment(event._id, qaInput); } }}
                                placeholder="Ask a question"
                                style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: "0.85rem", outline: "none" }}
                              />
                              <button type="button" onClick={() => void handleAddComment(event._id, qaInput)}
                                disabled={qaSubmitting || !qaInput.trim()}
                                style={{ background: "#4f46e5", color: "#fff", border: 0, borderRadius: 8, padding: "0 14px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
                                Ask
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          )} {/* end !eventsLoading */}
        </section>

        {/* MY PROFILE / REGISTRATIONS SECTION */}
        <section id="registrations" className="dashboard-section">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", color: "#fff", fontWeight: 700, flexShrink: 0, boxShadow: "0 4px 14px rgba(79,70,229,0.4)" }}>
              {user?.collegeName ? user.collegeName.charAt(0).toUpperCase() : "S"}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text)", fontWeight: 700 }}>My Dashboard</h3>
              {user?.collegeName && (
                <p style={{ margin: "3px 0 0", fontSize: "0.88rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <GraduationCap size={14} /> {user.collegeName}
                </p>
              )}
            </div>
          </div>

          {/*  Stats cards  */}
          {(() => {
            const confirmed = registrations.filter(r => r.status === "confirmed" || !r.status);
            const now = new Date();
            const attended  = confirmed.filter(r => { const ev = r.eventId as EventItem; return ev?.date && new Date(ev.date) < now; });
            const upcoming  = confirmed.filter(r => { const ev = r.eventId as EventItem; return ev?.date && new Date(ev.date) >= now; });
            const waitlisted = registrations.filter(r => r.status === "waitlisted");
            const colleges  = new Set(confirmed.map(r => { const ev = r.eventId as EventItem; return ev?.location; }).filter(Boolean));

            return (
              <>
                <div className="stat-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 28 }}>
                  {[
                    { label: "Registered",  value: confirmed.length,  icon: <Ticket size={20} />, color: "var(--primary)" },
                    { label: "Upcoming",    value: upcoming.length,   icon: <Calendar size={20} />, color: "var(--info)" },
                    { label: "Attended",    value: attended.length,   icon: <CheckCircle2 size={20} />, color: "var(--success)" },
                    { label: "Waitlisted",  value: waitlisted.length, icon: <Clock size={20} />, color: "var(--warning)" },
                    { label: "Venues",      value: colleges.size,     icon: <MapPin size={20} />, color: "var(--danger)" },
                  ].map(s => (
                    <div key={s.label} className="stat-card" style={{ flexDirection: "column", gap: 6, textAlign: "center", padding: "16px 12px", justifyContent: "center" }}>
                      <div style={{ color: s.color, display: "flex", justifyContent: "center" }}>{s.icon}</div>
                      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/*  Upcoming events  */}
                {upcoming.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ margin: "0 0 12px", color: "var(--text)", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: "linear-gradient(135deg,#0891b2,#06b6d4)", color: "#fff", borderRadius: 99, padding: "3px 12px", fontSize: "0.72rem", fontWeight: 700 }}>UPCOMING</span>
                      <span style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: "0.9rem" }}>{upcoming.length} event{upcoming.length !== 1 ? "s" : ""}</span>
                    </h4>
                    <div style={{ display: "grid", gap: 10 }}>
                      {upcoming.map(reg => {
                        const ev = reg.eventId as EventItem;
                        if (!ev?._id) return null;
                        const daysUntil = Math.ceil((new Date(ev.date).getTime() - Date.now()) / 86400000);
                        return (
                          <div key={reg._id} style={{ background: "var(--surface-2)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, boxShadow: "0 2px 8px rgba(79,70,229,0.07)" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.95rem" }}>{ev.title}</span>
                                {reg.status === "waitlisted" && (
                                  <span style={{ background: "rgba(168,85,247,0.15)", color: "#7c3aed", borderRadius: 99, padding: "1px 8px", fontSize: "0.68rem", fontWeight: 700 }}>Waitlist #{reg.waitlistPosition}</span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 14, fontSize: "0.78rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                                <span> <strong style={{ color: "var(--text-2)" }}>{new Date(ev.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</strong></span>
                                {ev.time && <span> {ev.time}</span>}
                                {ev.location && <span> {ev.location}</span>}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                              <span style={{
                                background: daysUntil <= 1 ? "#fee2e2" : daysUntil <= 3 ? "#fef3c7" : "#dcfce7",
                                color: daysUntil <= 1 ? "#991b1b" : daysUntil <= 3 ? "#92400e" : "#166534",
                                borderRadius: 99, padding: "3px 10px", fontSize: "0.73rem", fontWeight: 700, whiteSpace: "nowrap"
                              }}>
                                {daysUntil === 0 ? "🎯 Today!" : daysUntil === 1 ? "Tomorrow" : `📅 ${daysUntil} days`}
                              </span>
                              {reg.status !== "waitlisted" && (
                                <button type="button" onClick={() => void handleCancel(ev._id)} disabled={cancellingId === ev._id}
                                  style={{ background: "var(--surface-2)", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 7, padding: "3px 10px", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer" }}>
                                  {cancellingId === ev._id ? "" : "Cancel"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/*  Past events  */}
                {attended.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 12px", color: "var(--text)", fontSize: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)", borderRadius: 99, padding: "3px 12px", fontSize: "0.72rem", fontWeight: 700 }}>PAST</span>
                      <span style={{ color: "var(--text-muted)", fontWeight: 500, fontSize: "0.9rem" }}>{attended.length} event{attended.length !== 1 ? "s" : ""}</span>
                    </h4>
                    <div style={{ display: "grid", gap: 10 }}>
                      {attended.map(reg => {
                        const ev = reg.eventId as EventItem;
                        if (!ev?._id) return null;
                        const alreadyRated = submittedFeedbacks.has(ev._id);
                        return (
                          <div key={reg._id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 700, color: "var(--text-2)", fontSize: "0.95rem" }}>{ev.title}</span>
                              <div style={{ display: "flex", gap: 14, fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4, flexWrap: "wrap" }}>
                                <span><Calendar size={12} style={{ verticalAlign: "middle", marginRight: 3 }} />{new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                {ev.location && <span><MapPin size={12} style={{ verticalAlign: "middle", marginRight: 3 }} />{ev.location}</span>}
                              </div>
                              {ev.avgRating != null && ev.avgRating > 0 && (
                                <div style={{ fontSize: "0.75rem", color: "#f59e0b", marginTop: 4, display: "flex", alignItems: "center", gap: 2 }}>
                                  {Array.from({ length: 5 }, (_, i) => (
                                    <Star key={i} size={11} fill={i < Math.round(ev.avgRating!) ? "#f59e0b" : "none"} color="#f59e0b" />
                                  ))}
                                  <span style={{ color: "var(--text-dim)", marginLeft: 4 }}>{ev.avgRating.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                            {alreadyRated
                              ? <span style={{ fontSize: "0.78rem", color: "#059669", fontWeight: 700, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 3 }}><CheckCircle size={13} /> Rated</span>
                              : <button type="button" onClick={() => void openFeedbackModal(ev._id, ev.title)}
                                  style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "var(--text)", border: 0, borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: "0.78rem", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(245,158,11,0.3)" }}>
                                   Rate Event
                                </button>
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {registrations.length === 0 && (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-dim)" }}>
                    <div style={{ fontSize: "3rem", marginBottom: 14 }}></div>
                    <p style={{ margin: 0, fontWeight: 700, color: "var(--text-2)", fontSize: "1rem" }}>No registrations yet</p>
                    <p style={{ margin: "6px 0 0", fontSize: "0.88rem", color: "var(--text-dim)" }}>Browse events above and register to get started!</p>
                  </div>
                )}
              </>
            );
          })()}
        </section>

        {/*  CERTIFICATES SECTION  */}
        {(() => {
          const certRegs = registrations.filter(r =>
            r.attendanceStatus === "present" && (r.eventId as EventItem)?.certificatesEnabled
          );
          if (certRegs.length === 0) return null;
          return (
            <section className="dashboard-section" style={{ marginTop: 8 }}>
              <h3 style={{ margin: "0 0 20px", fontSize: "1.1rem", color: "var(--text)", display: "flex", alignItems: "center", gap: 10 }}>
                <GraduationCap size={20} color="#7c3aed" />
                My Certificates
                <span style={{ background: "rgba(124,58,237,0.15)", color: "#7c3aed", borderRadius: 99, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700, marginLeft: 4 }}>
                  {certRegs.length} ready
                </span>
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                {certRegs.map(reg => {
                  const ev = reg.eventId as EventItem;
                  return (
                    <div key={reg._id} style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.08),rgba(79,70,229,0.05))", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      {/* Icon */}
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
                        <GraduationCap size={24} color="#fff" />
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, color: "var(--text)", fontSize: "0.95rem" }}>{ev?.title ?? "Event"}</p>
                        <p style={{ margin: "3px 0 0", fontSize: "0.78rem", color: "var(--text-dim)" }}>
                          {ev?.date ? new Date(ev.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                          {ev?.location ? ` · ${ev.location}` : ""}
                        </p>
                        {reg.certificateId && (
                          <p style={{ margin: "4px 0 0", fontSize: "0.72rem", fontFamily: "monospace", color: "#818cf8", fontWeight: 700 }}>
                            {reg.certificateId}
                          </p>
                        )}
                      </div>
                      {/* Badge + Download */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                        <span style={{ background: "rgba(34,197,94,0.15)", color: "#15803d", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 99, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
                          ✓ Attended
                        </span>
                        <button
                          type="button"
                          onClick={() => void (async () => {
                            try {
                              const { downloadCertificatePdf } = await import("../services/attendanceService");
                              await downloadCertificatePdf(reg._id);
                            } catch (err: any) {
                              setFeedback({ type: "error", message: err?.message || "Certificate download failed." });
                            }
                          })()}
                          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff", border: 0, borderRadius: 9, padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 4px 14px rgba(124,58,237,0.35)" }}
                        >
                          <Award size={14} /> Download Certificate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}
      </main>

      {/*  FEEDBACK MODAL  */}
      {feedbackEventId && (
        <div className="modal-backdrop" onClick={() => setFeedbackEventId(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3 style={{ margin: "0 0 4px" }}>Rate this event</h3>
            <p style={{ margin: "0 0 20px", color: "var(--text-muted)", fontSize: "0.88rem" }}>{feedbackEventTitle}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                  onMouseEnter={() => setStarHover(n)} onMouseLeave={() => setStarHover(0)}
                  onClick={() => setStarRating(n)}
                  style={{ background: "none", border: 0, cursor: "pointer", fontSize: "2.2rem", lineHeight: 1,
                    color: n <= (starHover || starRating) ? "#FFB703" : "#e2e8f0",
                    transform: n <= (starHover || starRating) ? "scale(1.15)" : "scale(1)", transition: "all 0.1s" }}></button>
              ))}
            </div>
            {starRating > 0 && (
              <p style={{ textAlign: "center", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
                {["","Poor","Fair","Good","Very Good","Excellent"][starRating]} ({starRating}/5)
              </p>
            )}
            <textarea value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)}
              placeholder="Share your experience (optional)" rows={3}
              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", fontSize: "0.9rem", outline: "none", resize: "vertical", marginBottom: 16 }} />
            <div className="button-row">
              <button type="button" onClick={() => void handleFeedbackSubmit()}
                disabled={feedbackLoading || starRating === 0} className="btn btn-gradient" style={{ flex: 1 }}>
                {feedbackLoading ? "Submitting…" : "Submit Feedback ⭐"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setFeedbackEventId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/*  REGISTER / JOIN WAITLIST MODAL  */}
      {selectedEventId && (
        <div className="modal-backdrop" onClick={() => setSelectedEventId(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            {(() => {
              const ev = events.find(e => e._id === selectedEventId);
              const isFull = ev && ev.maxRegistrations != null && (ev.registrationCount ?? 0) >= ev.maxRegistrations;
              return (
                <>
                  <h3>{isFull ? "Join Waitlist" : "Register for Event"}</h3>
                  {isFull && (
                    <div style={{ background: "rgba(168,85,247,0.15)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: "0.85rem", color: "#7c3aed" }}>
                      This event is full. You'll be added to the waitlist and notified automatically if a spot opens.
                    </div>
                  )}
                  {ev?.isPaid && !isFull && (
                    <div style={{ background: "rgba(245,158,11,0.15)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: "0.85rem", color: "var(--warning)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>💳 This is a <strong>paid event</strong>. After registering you'll be prompted to complete payment.</span>
                      <span style={{ fontWeight: 800, fontSize: "1rem", color: "#059669", marginLeft: 12, whiteSpace: "nowrap" }}>{ev.price}</span>
                    </div>
                  )}
                  {(user?.collegeName || user?.company) && (
                    <div style={{ background: "var(--surface)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: "0.85rem", color: "var(--text)" }}>
                      Registering as: <strong>{user.collegeName || user.company || user.name}</strong>
                    </div>
                  )}
                  <div className="admin-form">
                    <input value={registerForm.name} onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />

                    {/* Student: College ID | Professional: Company + Designation */}
                    {user?.role === "professional" ? (
                      <>
                        <input
                          value={registerForm.company}
                          onChange={e => setRegisterForm(p => ({ ...p, company: e.target.value }))}
                          placeholder="Company / Organisation (e.g. Google, Freelancer)"
                        />
                        <input
                          value={registerForm.designation}
                          onChange={e => setRegisterForm(p => ({ ...p, designation: e.target.value }))}
                          placeholder="Your role / designation (e.g. Software Engineer)"
                          required
                        />
                      </>
                    ) : (
                      <input
                        value={registerForm.collegeId}
                        onChange={e => setRegisterForm(p => ({ ...p, collegeId: e.target.value }))}
                        placeholder="College ID / Roll number"
                      />
                    )}
                    <select
                      value={registerForm.department}
                      onChange={e => setRegisterForm(p => ({ ...p, department: e.target.value }))}
                      style={{ width: "100%" }}
                    >
                      <option value="">— Select Branch / Department —</option>
                      <optgroup label="Engineering">
                        <option>Computer Science Engineering (CSE)</option>
                        <option>Computer Science and Information Technology (CSIT)</option>
                        <option>Information Science Engineering (ISE)</option>
                        <option>Artificial Intelligence and Machine Learning (AIML)</option>
                        <option>Data Science (DS)</option>
                        <option>Electronics and Communication Engineering (ECE)</option>
                        <option>Electrical and Electronics Engineering (EEE)</option>
                        <option>Mechanical Engineering (ME)</option>
                        <option>Civil Engineering (CE)</option>
                        <option>Aerospace Engineering</option>
                        <option>Biotechnology Engineering</option>
                        <option>Chemical Engineering</option>
                        <option>Industrial Engineering</option>
                      </optgroup>
                      <optgroup label="Science">
                        <option>Physics</option>
                        <option>Chemistry</option>
                        <option>Mathematics</option>
                        <option>Biology / Life Sciences</option>
                      </optgroup>
                      <optgroup label="Management & Commerce">
                        <option>Business Administration (BBA / MBA)</option>
                        <option>Commerce (B.Com / M.Com)</option>
                        <option>Economics</option>
                        <option>Finance</option>
                        <option>Marketing</option>
                        <option>Human Resources (HR)</option>
                      </optgroup>
                      <optgroup label="Arts & Humanities">
                        <option>English Literature</option>
                        <option>Psychology</option>
                        <option>Sociology</option>
                        <option>Political Science</option>
                        <option>Journalism / Media</option>
                        <option>Design / Fine Arts</option>
                      </optgroup>
                      <optgroup label="Law & Medicine">
                        <option>Law (LLB / LLM)</option>
                        <option>Medicine (MBBS / BDS)</option>
                        <option>Pharmacy</option>
                        <option>Nursing</option>
                      </optgroup>
                      <optgroup label="Professional / Industry">
                        <option>Software Development</option>
                        <option>Product Management</option>
                        <option>Data Analytics</option>
                        <option>Cybersecurity</option>
                        <option>DevOps / Cloud</option>
                        <option>UI/UX Design</option>
                        <option>Sales & Business Development</option>
                        <option>Operations</option>
                        <option>Consulting</option>
                        <option>Research & Development</option>
                        <option>Others — Please specify below</option>
                      </optgroup>
                    </select>
                    {registerForm.department === "Others — Please specify below" && (
                      <input
                        value={registerForm.customDepartment ?? ""}
                        onChange={e => setRegisterForm(p => ({ ...p, customDepartment: e.target.value }))}
                        placeholder="Describe your role or field (e.g. Freelance Designer, HR Manager…)"
                        style={{ marginTop: 6 }}
                      />
                    )}
                    <div className="button-row">
                      <button type="button" className="btn btn-gradient"
                        style={{ background: isFull ? "linear-gradient(135deg,#7c3aed,#8b5cf6)" : undefined }}
                        onClick={() => void handleRegister(selectedEventId)}>
                        {isFull ? "Join Waitlist" : "Submit Registration"}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setSelectedEventId(null)}>Cancel</button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/*  PAYMENT MODAL  */}
      {paymentTarget && (
        <PaymentModal
          registrationId={paymentTarget.registrationId}
          eventTitle={paymentTarget.event.title}
          price={paymentTarget.event.price ?? 0}
          upiId={paymentTarget.event.upiId}
          qrImage={paymentTarget.event.qrImage}
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => {
            setPaymentTarget(null);
            void loadRegistrations();
            void fetchEvents();
            setFeedback({ type: "success", message: "Payment submitted! Admin will verify shortly." });
          }}
        />
      )}
    </div>
  );
}


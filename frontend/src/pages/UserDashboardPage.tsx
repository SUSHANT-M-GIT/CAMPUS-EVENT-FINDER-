import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppNavbar from "../components/AppNavbar";
import Alert from "../components/Alert";
import PaymentModal from "../components/PaymentModal";
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
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [registerForm, setRegisterForm]   = useState({ name: "", collegeId: "", department: "" });
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
    // Close share popover on outside click — removed (share is now direct copy)
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchEvents, loadRegistrations]);

  // Map eventId → registration for quick lookup
  const registrationByEventId = useMemo(() => {
    const map = new Map<string, RegistrationItem>();
    registrations.forEach(r => {
      const id = typeof r.eventId === "string" ? r.eventId : r.eventId?._id;
      if (id) map.set(id, r);
    });
    return map;
  }, [registrations]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    void fetchEvents(searchInput, typeFilter);
  };

  const handleTypeChange = (t: string) => {
    setTypeFilter(t);
    void fetchEvents(search, t);
  };

  const handleClearSearch = () => {
    setSearchInput(""); setSearch(""); setTypeFilter("");
    void fetchEvents("", "");
  };

  const handleRegister = async (eventId: string) => {
    if (!registerForm.name || !registerForm.collegeId || !registerForm.department) {
      setFeedback({ type: "error", message: "Please fill all registration details." });
      return;
    }
    try {
      const response = await registerForEvent(eventId, { ...registerForm, collegeName: user?.collegeName || "" });

      if (response.status === "confirmed" && !response.isPaid) {
        setEvents(prev => prev.map(ev =>
          ev._id === eventId ? { ...ev, registrationCount: (ev.registrationCount ?? 0) + 1 } : ev
        ));
      }

      await loadRegistrations();
      setTimeout(() => { void fetchEvents(); }, 500);
      setSelectedEventId(null);
      setRegisterForm({ name: "", collegeId: "", department: "" });

      // If paid event — open payment modal immediately
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

  // Q&A state
  const [qaOpenId, setQaOpenId]           = useState<string | null>(null);
  const [comments, setComments]           = useState<Record<string, CommentItem[]>>({});
  const [qaLoading, setQaLoading]         = useState<string | null>(null);
  const [qaInput, setQaInput]             = useState("");
  const [replyingTo, setReplyingTo]       = useState<string | null>(null);
  const [replyInput, setReplyInput]       = useState("");
  const [qaSubmitting, setQaSubmitting]   = useState(false);

  // Payment modal state
  interface PaymentTarget { registrationId: string; event: EventItem; }
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);

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
    setFeedback({ type: "success", message: "Event link copied to clipboard! 🔗" });
  };

  const handleCancel = async (eventId: string) => {
    if (!window.confirm("Cancel your registration? If you're confirmed, the next person on the waitlist will be promoted automatically.")) return;
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
      setFeedback({ type: "success", message: "Thank you for your feedback! ⭐" });
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Failed to submit feedback." });
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <AppNavbar links={[
        { label: "Events", href: "#events" },
        { label: "My Registrations", href: "#registrations" },
        { label: "Logout", onClick: handleLogout },
      ]} />

      <section className="dashboard-banner app-container">
        <img src="https://images.unsplash.com/photo-1511578314322-379afb476865" alt="Students at a campus event" />
        <div className="dashboard-banner-overlay">
          <h1>User Dashboard</h1>
          <p>Explore and register for events</p>
        </div>
      </section>

      <main className="app-container dashboard-content">
        {feedback && <Alert type={feedback.type} message={feedback.message} />}

        {/* ── EVENTS SECTION ── */}
        <section id="events" className="dashboard-section">
          <h3 style={{ margin: "0 0 16px" }}>Events</h3>

          <form onSubmit={handleSearch} style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="🔍  Search events, tags, keywords…"
                style={{ width: "100%", border: "1.5px solid #cde8f5", borderRadius: 9, padding: "10px 36px 10px 12px", fontSize: "0.92rem", outline: "none" }} />
              {searchInput && (
                <button type="button" onClick={handleClearSearch}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, cursor: "pointer", color: "#94a3b8", fontSize: "1rem" }}>✕</button>
              )}
            </div>
            <select value={typeFilter} onChange={e => handleTypeChange(e.target.value)}
              style={{ border: "1.5px solid #cde8f5", borderRadius: 9, padding: "10px 12px", fontSize: "0.92rem", outline: "none", background: "#fff", minWidth: 150 }}>
              <option value="">All Categories</option>
              {["hackathon","tech","seminar","games","movie","other"].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-gradient" style={{ padding: "10px 20px", whiteSpace: "nowrap" }}>Search</button>
          </form>

          {noResultsMsg && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: similarEvents.length ? 12 : 0 }}>🔎 {noResultsMsg}</p>
              {similarEvents.length > 0 && <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginBottom: 12 }}>Here are some similar events you might like:</p>}
            </div>
          )}

          <div className="event-grid">
            {(noResultsMsg ? similarEvents : events).map((event) => {
              const myReg = registrationByEventId.get(event._id);
              const isFull = event.maxRegistrations != null && (event.registrationCount ?? 0) >= event.maxRegistrations;
              return (
                <article key={event._id} className="event-card">
                  <img
                    src={event.bannerImage
                      ? (event.bannerSource === "local" ? `${API_BASE}${event.bannerImage}` : event.bannerImage)
                      : "https://images.unsplash.com/photo-1503676260728-1c00da094a0b"}
                    alt={event.title}
                    style={{ width: "100%", height: 160, objectFit: "cover" }}
                  />
                  <div className="event-card-body">
                    <h4>{event.title}</h4>
                    {event.tags && event.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
                        {event.tags.map(tag => (
                          <span key={tag} style={{ background: "#eef2ff", color: "#4f46e5", borderRadius: 99, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 600 }}>#{tag}</span>
                        ))}
                      </div>
                    )}
                    <p>{event.description}</p>
                    <div className="event-meta">
                      <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                      <span>📍 {event.location}</span>
                    </div>
                    {event.avgRating != null && event.avgRating > 0 && (
                      <div style={{ fontSize: "0.78rem", color: "#FFB703", fontWeight: 600 }}>
                        {"★".repeat(Math.round(event.avgRating))}{"☆".repeat(5 - Math.round(event.avgRating))}
                        <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: 4 }}>{event.avgRating.toFixed(1)} ({event.feedbackCount})</span>
                      </div>
                    )}
                    {event.maxRegistrations != null && (
                      <div style={{ marginTop: 2 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#94a3b8", marginBottom: 3 }}>
                          <span>{event.registrationCount ?? 0} registered</span>
                          <span>max {event.maxRegistrations}</span>
                        </div>
                        <div style={{ height: 5, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 99, transition: "width 0.4s ease",
                            width: `${Math.min(100, Math.round(((event.registrationCount ?? 0) / event.maxRegistrations) * 100))}%`,
                            background: isFull ? "#FB8500" : "#219EBC" }} />
                        </div>
                        {isFull && !myReg && (
                          <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#8b5cf6", fontWeight: 600 }}>
                            ⏳ Event full — you can join the waitlist
                          </p>
                        )}
                      </div>
                    )}
                    {myReg ? (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {myReg.status === "waitlisted" ? (
                          <span style={{ background: "#f3e8ff", color: "#7c3aed", borderRadius: 8, padding: "6px 12px", fontSize: "0.82rem", fontWeight: 600 }}>
                            ⏳ Waitlisted #{myReg.waitlistPosition}
                          </span>
                        ) : (
                          /* Confirmed — show payment badge for paid events */
                          myReg.paymentStatus === "pending" ? (
                            <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "6px 12px", fontSize: "0.82rem", fontWeight: 600 }}>
                              💳 Payment Pending
                            </span>
                          ) : myReg.paymentStatus === "rejected" ? (
                            <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "6px 12px", fontSize: "0.82rem", fontWeight: 600 }}>
                              ❌ Payment Rejected
                            </span>
                          ) : (
                            <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "6px 12px", fontSize: "0.82rem", fontWeight: 600 }}>
                              ✓ Registered
                            </span>
                          )
                        )}

                        {/* Re-submit payment for rejected */}
                        {myReg.paymentStatus === "rejected" && (
                          <button
                            type="button"
                            onClick={() => setPaymentTarget({ registrationId: myReg._id, event })}
                            style={{ background: "#4f46e5", color: "#fff", border: 0, borderRadius: 8, padding: "6px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                          >
                            💳 Pay Again
                          </button>
                        )}

                        {/* Pay Now for pending (not yet submitted) */}
                        {myReg.paymentStatus === "pending" && !myReg.transactionId && (
                          <button
                            type="button"
                            onClick={() => setPaymentTarget({ registrationId: myReg._id, event })}
                            style={{ background: "#059669", color: "#fff", border: 0, borderRadius: 8, padding: "6px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                          >
                            💳 Pay Now
                          </button>
                        )}

                        {/* Payment rejection reason */}
                        {myReg.paymentStatus === "rejected" && myReg.paymentNote && (
                          <p style={{ width: "100%", margin: "2px 0 0", fontSize: "0.75rem", color: "#991b1b" }}>
                            Reason: {myReg.paymentNote}
                          </p>
                        )}

                        {myReg.status !== "waitlisted" && myReg.paymentStatus !== "pending" && (
                          <button type="button" onClick={() => void handleCancel(event._id)}
                            disabled={cancellingId === event._id}
                            style={{ background: "#fee2e2", color: "#991b1b", border: 0, borderRadius: 8, padding: "6px 12px", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                            {cancellingId === event._id ? "Cancelling…" : "Cancel"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <button type="button" onClick={() => setSelectedEventId(event._id)} className="btn btn-gradient"
                        style={{ background: isFull ? "linear-gradient(135deg,#7c3aed,#8b5cf6)" : undefined }}>
                        {isFull ? "⏳ Join Waitlist" : event.isPaid ? `Register · ₹${event.price}` : "Register"}
                      </button>
                    )}

                    {/* ── Share button — copies link directly ── */}
                    <button
                      type="button"
                      onClick={() => void handleShare(event)}
                      title="Copy event link"
                      style={{ background: "#f1f5f9", color: "#475569", border: 0, borderRadius: 8, padding: "6px 10px", fontSize: "0.85rem", cursor: "pointer", lineHeight: 1 }}
                    >
                      🔗
                    </button>
                  </div>

                  {/* ── Q&A panel ── */}
                  <div style={{ borderTop: "1px solid #f1f5f9" }}>
                    <button
                      type="button"
                      onClick={() => toggleQa(event._id)}
                      style={{ width: "100%", background: "none", border: 0, padding: "10px 14px", cursor: "pointer", fontSize: "0.82rem", color: "#64748b", fontWeight: 600, textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      💬 Q&A
                      {comments[event._id]?.length > 0 && (
                        <span style={{ background: "#eef2ff", color: "#4f46e5", borderRadius: 99, padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700 }}>
                          {comments[event._id].length}
                        </span>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: "0.7rem" }}>{qaOpenId === event._id ? "▲" : "▼"}</span>
                    </button>

                    {qaOpenId === event._id && (
                      <div style={{ padding: "0 14px 14px" }}>
                        {qaLoading === event._id ? (
                          <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: "8px 0" }}>Loading…</p>
                        ) : (
                          <>
                            {/* Comment list */}
                            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                              {(comments[event._id] ?? []).length === 0 && (
                                <p style={{ color: "#94a3b8", fontSize: "0.82rem", margin: 0 }}>No questions yet. Be the first to ask!</p>
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
                                              <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 99, padding: "1px 6px", fontSize: "0.68rem", fontWeight: 700 }}>Admin</span>
                                            )}
                                            <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>
                                              {new Date(c.createdAt).toLocaleDateString()}
                                            </span>
                                          </div>
                                          <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155", lineHeight: 1.5 }}>{c.text}</p>
                                        </div>
                                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                                          {/* Students cannot reply — only the event admin can */}
                                          {isMe && (
                                            <button type="button" onClick={() => void handleDeleteComment(c._id, event._id)}
                                              style={{ background: "none", border: 0, color: "#ef4444", fontSize: "0.75rem", cursor: "pointer", padding: "2px 4px" }}>✕</button>
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
                                                    {rIsAdmin && <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 99, padding: "1px 6px", fontSize: "0.68rem", fontWeight: 700 }}>Admin</span>}
                                                    <span style={{ color: "#94a3b8", fontSize: "0.7rem" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                                                  </div>
                                                  <p style={{ margin: 0, fontSize: "0.83rem", color: "#334155", lineHeight: 1.5 }}>{r.text}</p>
                                                </div>
                                                {rIsMe && (
                                                  <button type="button" onClick={() => void handleDeleteComment(r._id, event._id)}
                                                    style={{ background: "none", border: 0, color: "#ef4444", fontSize: "0.75rem", cursor: "pointer", padding: "2px 4px", flexShrink: 0 }}>✕</button>
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
                                          placeholder="Write a reply…"
                                          style={{ flex: 1, border: "1.5px solid #c7d2fe", borderRadius: 7, padding: "7px 10px", fontSize: "0.82rem", outline: "none" }}
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
                                placeholder="Ask a question…"
                                style={{ flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: "0.85rem", outline: "none" }}
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
            {!noResultsMsg && events.length === 0 && <p className="muted" style={{ gridColumn: "1/-1" }}>No events available right now.</p>}
            {noResultsMsg && similarEvents.length === 0 && <p className="muted" style={{ gridColumn: "1/-1" }}>No similar events found either.</p>}
          </div>
        </section>

        {/* ── MY PROFILE / REGISTRATIONS SECTION ── */}
        <section id="registrations" className="dashboard-section">

          {/* ── Profile header ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", color: "#fff", fontWeight: 700, flexShrink: 0 }}>
              {user?.collegeName ? user.collegeName.charAt(0).toUpperCase() : "S"}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#1e293b" }}>My Profile</h3>
              {user?.collegeName && <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "#64748b" }}>🏫 {user.collegeName}</p>}
            </div>
          </div>

          {/* ── Stats cards ── */}
          {(() => {
            const confirmed = registrations.filter(r => r.status === "confirmed" || !r.status);
            const now = new Date();
            const attended  = confirmed.filter(r => { const ev = r.eventId as EventItem; return ev?.date && new Date(ev.date) < now; });
            const upcoming  = confirmed.filter(r => { const ev = r.eventId as EventItem; return ev?.date && new Date(ev.date) >= now; });
            const waitlisted = registrations.filter(r => r.status === "waitlisted");
            const colleges  = new Set(confirmed.map(r => { const ev = r.eventId as EventItem; return ev?.location; }).filter(Boolean));

            return (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12, marginBottom: 28 }}>
                  {[
                    { label: "Total Registered", value: confirmed.length, icon: "🎟️", color: "#4f46e5", bg: "#eef2ff" },
                    { label: "Upcoming",          value: upcoming.length,  icon: "📅", color: "#0891b2", bg: "#e0f2fe" },
                    { label: "Attended",          value: attended.length,  icon: "✅", color: "#059669", bg: "#dcfce7" },
                    { label: "On Waitlist",       value: waitlisted.length,icon: "⏳", color: "#7c3aed", bg: "#f3e8ff" },
                    { label: "Venues Visited",    value: colleges.size,    icon: "📍", color: "#d97706", bg: "#fef3c7" },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>{s.icon}</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: 3, fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* ── Upcoming events ── */}
                {upcoming.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <h4 style={{ margin: "0 0 12px", color: "#1e293b", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "#e0f2fe", color: "#0891b2", borderRadius: 99, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700 }}>UPCOMING</span>
                      {upcoming.length} event{upcoming.length !== 1 ? "s" : ""}
                    </h4>
                    <div style={{ display: "grid", gap: 10 }}>
                      {upcoming.map(reg => {
                        const ev = reg.eventId as EventItem;
                        if (!ev?._id) return null;
                        const daysUntil = Math.ceil((new Date(ev.date).getTime() - Date.now()) / 86400000);
                        return (
                          <div key={reg._id} style={{ background: "#fff", border: "1.5px solid #bfdbfe", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                <span style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>{ev.title}</span>
                                {reg.status === "waitlisted" && (
                                  <span style={{ background: "#f3e8ff", color: "#7c3aed", borderRadius: 99, padding: "1px 8px", fontSize: "0.7rem", fontWeight: 700 }}>Waitlist #{reg.waitlistPosition}</span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 14, fontSize: "0.8rem", color: "#64748b", flexWrap: "wrap" }}>
                                <span>📅 {new Date(ev.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                                {ev.time && <span>⏰ {ev.time}</span>}
                                {ev.location && <span>📍 {ev.location}</span>}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                              <span style={{ background: daysUntil <= 1 ? "#fee2e2" : daysUntil <= 3 ? "#fef3c7" : "#dcfce7", color: daysUntil <= 1 ? "#991b1b" : daysUntil <= 3 ? "#92400e" : "#166534", borderRadius: 99, padding: "3px 10px", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                                {daysUntil === 0 ? "Today!" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
                              </span>
                              {reg.status !== "waitlisted" && (
                                <button type="button" onClick={() => void handleCancel(ev._id)}
                                  disabled={cancellingId === ev._id}
                                  style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 7, padding: "3px 10px", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" }}>
                                  {cancellingId === ev._id ? "…" : "Cancel"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Past events ── */}
                {attended.length > 0 && (
                  <div>
                    <h4 style={{ margin: "0 0 12px", color: "#1e293b", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "#f1f5f9", color: "#475569", borderRadius: 99, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700 }}>PAST</span>
                      {attended.length} event{attended.length !== 1 ? "s" : ""}
                    </h4>
                    <div style={{ display: "grid", gap: 10 }}>
                      {attended.map(reg => {
                        const ev = reg.eventId as EventItem;
                        if (!ev?._id) return null;
                        const alreadyRated = submittedFeedbacks.has(ev._id);
                        return (
                          <div key={reg._id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 600, color: "#475569", fontSize: "0.95rem" }}>{ev.title}</span>
                              <div style={{ display: "flex", gap: 14, fontSize: "0.8rem", color: "#94a3b8", marginTop: 4, flexWrap: "wrap" }}>
                                <span>📅 {new Date(ev.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                {ev.location && <span>📍 {ev.location}</span>}
                              </div>
                              {ev.avgRating != null && ev.avgRating > 0 && (
                                <div style={{ fontSize: "0.75rem", color: "#FFB703", marginTop: 4 }}>
                                  {"★".repeat(Math.round(ev.avgRating))}{"☆".repeat(5 - Math.round(ev.avgRating))}
                                  <span style={{ color: "#94a3b8", marginLeft: 4 }}>{ev.avgRating.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                            {alreadyRated
                              ? <span style={{ fontSize: "0.78rem", color: "#10b981", fontWeight: 600, whiteSpace: "nowrap" }}>✓ Rated</span>
                              : <button type="button" onClick={() => void openFeedbackModal(ev._id, ev.title)}
                                  style={{ background: "#FFB703", color: "#023047", border: 0, borderRadius: 8, padding: "6px 12px", fontWeight: 700, cursor: "pointer", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                                  ⭐ Rate
                                </button>
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {registrations.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎟️</div>
                    <p style={{ margin: 0, fontWeight: 600 }}>No registrations yet</p>
                    <p style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>Browse events above and register to get started!</p>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      </main>

      {/* ── FEEDBACK MODAL ── */}
      {feedbackEventId && (
        <div className="modal-backdrop" onClick={() => setFeedbackEventId(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3 style={{ margin: "0 0 4px" }}>Rate this event</h3>
            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "0.88rem" }}>{feedbackEventTitle}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button"
                  onMouseEnter={() => setStarHover(n)} onMouseLeave={() => setStarHover(0)}
                  onClick={() => setStarRating(n)}
                  style={{ background: "none", border: 0, cursor: "pointer", fontSize: "2.2rem", lineHeight: 1,
                    color: n <= (starHover || starRating) ? "#FFB703" : "#e2e8f0",
                    transform: n <= (starHover || starRating) ? "scale(1.15)" : "scale(1)", transition: "all 0.1s" }}>★</button>
              ))}
            </div>
            {starRating > 0 && (
              <p style={{ textAlign: "center", fontSize: "0.85rem", color: "#64748b", marginBottom: 16 }}>
                {["","Poor","Fair","Good","Very Good","Excellent"][starRating]} ({starRating}/5)
              </p>
            )}
            <textarea value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)}
              placeholder="Share your experience (optional)…" rows={3}
              style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "10px 12px", fontSize: "0.9rem", outline: "none", resize: "vertical", marginBottom: 16 }} />
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

      {/* ── REGISTER / JOIN WAITLIST MODAL ── */}
      {selectedEventId && (
        <div className="modal-backdrop" onClick={() => setSelectedEventId(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            {(() => {
              const ev = events.find(e => e._id === selectedEventId);
              const isFull = ev && ev.maxRegistrations != null && (ev.registrationCount ?? 0) >= ev.maxRegistrations;
              return (
                <>
                  <h3>{isFull ? "⏳ Join Waitlist" : "Register for Event"}</h3>
                  {isFull && (
                    <div style={{ background: "#f3e8ff", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: "0.85rem", color: "#7c3aed" }}>
                      This event is full. You'll be added to the waitlist and notified automatically if a spot opens.
                    </div>
                  )}
                  {ev?.isPaid && !isFull && (
                    <div style={{ background: "#fef3c7", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: "0.85rem", color: "#92400e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>💳 This is a <strong>paid event</strong>. After registering you'll be prompted to complete payment.</span>
                      <span style={{ fontWeight: 800, fontSize: "1rem", color: "#059669", marginLeft: 12, whiteSpace: "nowrap" }}>₹{ev.price}</span>
                    </div>
                  )}
                  {user?.collegeName && (
                    <div style={{ background: "#f0f7fb", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: "0.85rem", color: "#023047" }}>
                      🏫 Registering as: <strong>{user.collegeName}</strong>
                    </div>
                  )}
                  <div className="admin-form">
                    <input value={registerForm.name} onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
                    <input value={registerForm.collegeId} onChange={e => setRegisterForm(p => ({ ...p, collegeId: e.target.value }))} placeholder="College ID / Roll number" />
                    <input value={registerForm.department} onChange={e => setRegisterForm(p => ({ ...p, department: e.target.value }))} placeholder="Department (e.g. Computer Science)" />
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

      {/* ── PAYMENT MODAL ── */}
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
            setFeedback({ type: "success", message: "Payment submitted! Awaiting admin verification." });
          }}
        />
      )}
    </div>
  );
}

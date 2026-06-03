import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { createEvent, deleteEvent, getEvents, updateEvent } from "../services/eventService";
import { getEventRegistrations } from "../services/registrationService";
import { getPendingPayments, approvePayment, rejectPayment, getPendingRefunds, approveRefund, rejectRefund } from "../services/paymentService";
import { getEventFeedback } from "../services/feedbackService";
import { getComments, addComment, deleteComment } from "../services/commentService";
import QrScannerModal from "../components/QrScannerModal";
import api from "../services/api";
import type { EventItem, FeedbackItem, CommentItem, RegistrationItem } from "../types";

// Derive backend base URL for serving static assets (screenshots, banners)
const API_BASE = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

// ── palette — matches the new design system ──────────────────────────────────
const C = {
  dark:   "#2B2D42",   // dark navy (primary)
  cyan:   "#EF233C",   // bright red (accent / CTA)
  light:  "#8D99AE",   // muted blue-gray
  yellow: "#EF233C",   // red (replaces yellow for highlights)
  orange: "#D90429",   // deep red (replaces orange for warnings/delete)
  bg:     "#EDF2F4",   // off-white background
};

// ── default form ─────────────────────────────────────────────────────────────
const defaultForm = {
  title: "", description: "",
  type: "other" as EventItem["type"],
  date: "", time: "", registrationDeadline: "", location: "",
  maxRegistrations: 100,
  eligibility: "all" as "all" | "own_college",
  tags: [] as string[],
  imageFile: null as File | null,
  gdriveLink: "",
  // Payment
  isPaid: false,
  price: 0,
  upiId: "",
  qrImageFile: null as File | null,
  // Refund policy
  refundAllowed: false,
  refundPercentage: 80,
  refundCutoffHours: 48,
};

// ── preset tags grouped by category ──────────────────────────────────────────
const PRESET_TAGS = [
  "AI", "ML", "Hackathon", "Coding", "Web Dev", "App Dev",
  "Cybersecurity", "Data Science", "Robotics", "IoT",
  "Design", "UI/UX", "Gaming", "Sports", "Music",
  "Cultural", "Workshop", "Seminar", "Networking", "Career",
];

// ── tag picker component ──────────────────────────────────────────────────────
function TagPicker({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [custom, setCustom] = useState("");

  const toggle = (tag: string) => {
    const lower = tag.toLowerCase();
    onChange(tags.includes(lower) ? tags.filter(t => t !== lower) : [...tags, lower]);
  };

  const addCustom = () => {
    const t = custom.trim().toLowerCase();
    if (t && !tags.includes(t)) { onChange([...tags, t]); }
    setCustom("");
  };

  return (
    <div>
      {/* preset chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {PRESET_TAGS.map(tag => {
          const lower = tag.toLowerCase();
          const active = tags.includes(lower);
          return (
            <button key={tag} type="button" onClick={() => toggle(tag)}
              style={{
                padding: "4px 12px", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600,
                border: `1.5px solid ${active ? C.cyan : "#cde8f5"}`,
                background: active ? C.cyan : "#f0f7fb",
                color: active ? "#fff" : C.dark,
                cursor: "pointer", transition: "all 0.15s",
              }}>
              {active ? "✓ " : ""}{tag}
            </button>
          );
        })}
      </div>
      {/* custom tag input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Add custom tag…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="button" onClick={addCustom}
          style={{ background: C.dark, color: "#fff", border: 0, borderRadius: 9, padding: "0 16px", cursor: "pointer", fontWeight: 600, fontSize: "0.88rem" }}>
          + Add
        </button>
      </div>
      {/* selected tags */}
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {tags.map(t => (
            <span key={t} style={{ background: "#eef2ff", color: "#4f46e5", borderRadius: 99, padding: "3px 10px", fontSize: "0.78rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              #{t}
              <button type="button" onClick={() => onChange(tags.filter(x => x !== t))}
                style={{ background: "none", border: 0, cursor: "pointer", color: "#6366f1", fontWeight: 700, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── small reusable stat card ──────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: string; accent: string }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: "20px 24px",
      boxShadow: "0 2px 12px rgba(2,48,71,0.08)", borderLeft: `4px solid ${accent}`,
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{ fontSize: "1.8rem" }}>{icon}</div>
      <div>
        <div style={{ fontSize: "1.6rem", fontWeight: 700, color: C.dark, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

// ── capacity progress bar ─────────────────────────────────────────────────────
function CapacityBar({ count, max }: { count: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;
  const color = pct >= 90 ? C.orange : pct >= 60 ? C.yellow : C.cyan;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#64748b", marginBottom: 4 }}>
        <span>{count} / {max} registered</span>
        <span style={{ color, fontWeight: 600 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "#e2e8f0", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ── form field wrapper ────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: "0.82rem", fontWeight: 600, color: C.dark, fontFamily: "'DM Sans', sans-serif" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: `1.5px solid #d8dde6`, borderRadius: 12, padding: "10px 12px",
  fontSize: "0.92rem", outline: "none", width: "100%",
  fontFamily: "'DM Sans', sans-serif",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

// ── main component ────────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]   = useState<"overview" | "create" | "events" | "payments" | "refunds" | "attendance">("overview");
  const [events, setEvents]         = useState<EventItem[]>([]);
  const [regCounts, setRegCounts]   = useState<Record<string, number>>({});
  const [form, setForm]             = useState(defaultForm);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [feedback, setFeedback]     = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [viewEvent, setViewEvent]   = useState<EventItem | null>(null);
  const [viewRegs, setViewRegs]     = useState<any[]>([]);

  // Feedback state
  const [feedbackEvent, setFeedbackEvent]   = useState<EventItem | null>(null);
  const [feedbackData, setFeedbackData]     = useState<{ avgRating: number; feedbackCount: number; feedbacks: FeedbackItem[] } | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // Cancel event modal state
  const [cancelTarget, setCancelTarget]   = useState<EventItem | null>(null);
  const [cancelReason, setCancelReason]   = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Q&A state
  const [qaEvent, setQaEvent]           = useState<EventItem | null>(null);
  const [qaComments, setQaComments]     = useState<CommentItem[]>([]);
  const [qaLoading, setQaLoading]       = useState(false);
  const [replyInputs, setReplyInputs]   = useState<Record<string, string>>({});
  const [qaSubmitting, setQaSubmitting] = useState<string | null>(null);

  // Payments state
  const [pendingPayments, setPendingPayments]       = useState<RegistrationItem[]>([]);
  const [paymentsLoading, setPaymentsLoading]       = useState(false);
  const [rejectReason, setRejectReason]             = useState<Record<string, string>>({});
  const [paymentActionLoading, setPaymentActionLoading] = useState<string | null>(null);

  // Refunds state
  const [pendingRefunds, setPendingRefunds]           = useState<any[]>([]);
  const [refundsLoading, setRefundsLoading]           = useState(false);
  const [refundRejectReason, setRefundRejectReason]   = useState<Record<string, string>>({});
  const [refundActionLoading, setRefundActionLoading] = useState<string | null>(null);

  // QR Attendance Scanner state
  const [scannerTarget, setScannerTarget] = useState<{ eventId: string; eventTitle: string; certificatesEnabled?: boolean } | null>(null);

  const openQa = async (ev: EventItem) => {
    setQaEvent(ev);
    setQaLoading(true);
    try {
      const data = await getComments(ev._id);
      setQaComments(data);
    } catch { /* silent */ }
    finally { setQaLoading(false); }
  };

  const handleAdminReply = async (eventId: string, parentId: string) => {
    const text = (replyInputs[parentId] || "").trim();
    if (!text) return;
    setQaSubmitting(parentId);
    try {
      await addComment(eventId, text, parentId);
      const updated = await getComments(eventId);
      setQaComments(updated);
      setReplyInputs(prev => ({ ...prev, [parentId]: "" }));
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Failed to post reply." });
    } finally { setQaSubmitting(null); }
  };

  const handleAdminDeleteComment = async (commentId: string, eventId: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await deleteComment(commentId);
      const updated = await getComments(eventId);
      setQaComments(updated);
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Failed to delete." });
    }
  };

  const loadEvents = async () => {
    try {
      const data = await getEvents();
      setEvents(data);
      const counts = await Promise.all(
        data.map(async (ev) => {
          try { return [ev._id, (await getEventRegistrations(ev._id)).length] as const; }
          catch { return [ev._id, 0] as const; }
        })
      );
      setRegCounts(Object.fromEntries(counts));
    } catch { setFeedback({ type: "error", message: "Unable to fetch events." }); }
  };

  const loadPendingPayments = async () => {
    setPaymentsLoading(true);
    try {
      const data = await getPendingPayments();
      setPendingPayments(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setPaymentsLoading(false); }
  };

  const loadPendingRefunds = async () => {
    setRefundsLoading(true);
    try {
      const data = await getPendingRefunds();
      setPendingRefunds(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setRefundsLoading(false); }
  };

  const handleApprovePayment = async (regId: string) => {
    setPaymentActionLoading(regId);
    try {
      await approvePayment(regId);
      setFeedback({ type: "success", message: "🎉 Payment verified successfully. Registration completed." });
      await loadPendingPayments();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Approval failed." });
    } finally { setPaymentActionLoading(null); }
  };

  const handleRejectPayment = async (regId: string) => {
    setPaymentActionLoading(regId);
    try {
      await rejectPayment(regId, rejectReason[regId] || "");
      setFeedback({ type: "error", message: "❌ Payment rejected. Student has been notified." });
      setRejectReason(prev => { const n = { ...prev }; delete n[regId]; return n; });
      await loadPendingPayments();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Rejection failed." });
    } finally { setPaymentActionLoading(null); }
  };

  const handleApproveRefund = async (regId: string) => {
    setRefundActionLoading(regId);
    try {
      await approveRefund(regId);
      setFeedback({ type: "success", message: "✅ Refund approved. Student has been notified." });
      await loadPendingRefunds();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Refund approval failed." });
    } finally { setRefundActionLoading(null); }
  };

  const handleRejectRefund = async (regId: string) => {
    setRefundActionLoading(regId);
    try {
      await rejectRefund(regId, refundRejectReason[regId] || "");
      setFeedback({ type: "error", message: "❌ Refund rejected. Student has been notified." });
      setRefundRejectReason(prev => { const n = { ...prev }; delete n[regId]; return n; });
      await loadPendingRefunds();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Refund rejection failed." });
    } finally { setRefundActionLoading(null); }
  };

  useEffect(() => {
    void loadEvents();
    void loadPendingPayments();
    void loadPendingRefunds();
  }, []);

  const myEvents     = events.filter(e => e.createdBy === user?.id);
  const totalRegs    = myEvents.reduce((s, e) => s + (regCounts[e._id] ?? 0), 0);
  const activeEvents = myEvents.filter(e => new Date(e.registrationDeadline) > new Date()).length;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.name === "maxRegistrations" ? Number(e.target.value) : e.target.value }));

  const clearForm = () => { setForm(defaultForm); setEditingId(null); };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ed = new Date(form.date), dd = new Date(form.registrationDeadline), today = new Date();
    today.setHours(0,0,0,0); ed.setHours(0,0,0,0); dd.setHours(0,0,0,0);
    if (ed < today)  { alert("❌ Event date cannot be in the past"); return; }
    if (dd < today)  { alert("❌ Registration deadline cannot be in the past"); return; }
    if (dd > ed)     { alert("❌ Registration deadline cannot be after event date"); return; }
    if (form.maxRegistrations < 1) { alert("❌ Max registrations must be at least 1"); return; }
    try {
      if (editingId) {
        await updateEvent(editingId, form);
        setFeedback({ type: "success", message: "Event updated." });
      } else {
        await createEvent(form);
        setFeedback({ type: "success", message: "Event created!" });
        localStorage.setItem("events_last_updated", String(Date.now()));
      }
      clearForm(); await loadEvents(); setActiveTab("events");
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Failed to save event." });
    }
  };

  const handleEdit = (ev: EventItem) => {
    setEditingId(ev._id);
    setForm({
      title: ev.title, description: ev.description, type: ev.type,
      date: ev.date.slice(0,10), time: ev.time,
      registrationDeadline: ev.registrationDeadline.slice(0,16),
      location: ev.location, maxRegistrations: ev.maxRegistrations ?? 100,
      eligibility: ev.eligibility ?? "all",
      tags: ev.tags ?? [],
      imageFile: null,
      gdriveLink: ev.bannerSource === "gdrive" ? ev.bannerImage ?? "" : "",
      isPaid: ev.isPaid ?? false,
      price: ev.price ?? 0,
      upiId: ev.upiId ?? "",
      qrImageFile: null,
      refundAllowed: ev.refundAllowed ?? false,
      refundPercentage: ev.refundPercentage ?? 80,
      refundCutoffHours: ev.refundCutoffHours ?? 48,
    });
    setActiveTab("create");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (ev: EventItem) => {
    setCancelTarget(ev);
    setCancelReason("");
  };

  const confirmDelete = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await deleteEvent(cancelTarget._id, cancelReason);
      setFeedback({ type: "success", message: `"${cancelTarget.title}" cancelled. All registered students have been notified.` });
      setCancelTarget(null);
      await loadEvents();
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Delete failed." });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleViewRegs = async (ev: EventItem) => {
    try { setViewRegs(await getEventRegistrations(ev._id)); setViewEvent(ev); }
    catch { setFeedback({ type: "error", message: "Failed to load registrations." }); }
  };

  const handleViewFeedback = async (ev: EventItem) => {
    setFeedbackLoading(true);
    setFeedbackEvent(ev);
    setFeedbackData(null);
    try {
      const data = await getEventFeedback(ev._id);
      setFeedbackData(data);
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.response?.data?.msg || "Failed to load feedback." });
      setFeedbackEvent(null);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  // ── sidebar nav item ────────────────────────────────────────────────────────
  const NavItem = ({ id, icon, label, badge }: { id: typeof activeTab; icon: string; label: string; badge?: number }) => (
    <button
      onClick={() => {
        setActiveTab(id);
        if (id === "payments")   void loadPendingPayments();
        if (id === "refunds")    void loadPendingRefunds();
      }}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 16px", borderRadius: 10, border: 0, cursor: "pointer",
        width: "100%", textAlign: "left", fontSize: "0.9rem", fontWeight: 600,
        background: activeTab === id ? C.yellow : "transparent",
        color: activeTab === id ? C.dark : "rgba(255,255,255,0.8)",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ background: "#EF233C", color: "#fff", borderRadius: "50%", minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, padding: "0 4px" }}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────── */}
      <aside style={{
        width: 230, background: C.dark, color: "#fff",
        display: "flex", flexDirection: "column", padding: "0 12px 24px",
        position: "sticky", top: 0, height: "100vh", flexShrink: 0,
      }}>
        {/* brand */}
        <div style={{ padding: "24px 8px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 16 }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: "-0.02em" }}>🎓 CampusEvents</div>
          <div style={{ fontSize: "0.75rem", color: C.light, marginTop: 3 }}>Admin Panel</div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          <NavItem id="overview"    icon="📊" label="Overview" />
          <NavItem id="create"      icon="➕" label="Create Event" />
          <NavItem id="events"      icon="📋" label="My Events" />
          <NavItem id="payments"    icon="💳" label="Payments"   badge={pendingPayments.length} />
          <NavItem id="refunds"     icon="↩️" label="Refunds"    badge={pendingRefunds.length} />
          <NavItem id="attendance"  icon="📱" label="Attendance" />
        </nav>

        <button
          onClick={handleLogout}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 16px", borderRadius: 10, border: 0, cursor: "pointer",
            background: "rgba(251,133,0,0.15)", color: C.orange,
            fontWeight: 600, fontSize: "0.9rem", width: "100%",
          }}
        >
          🚪 Logout
        </button>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>

        {/* header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontFamily: "'Space Grotesk',sans-serif", color: C.dark, letterSpacing: "-0.025em" }}>
            {activeTab === "overview"    && "Dashboard Overview"}
            {activeTab === "create"      && (editingId ? "Update Event" : "Create New Event")}
            {activeTab === "events"      && "My Events"}
            {activeTab === "payments"    && "Payment Verification"}
            {activeTab === "refunds"     && "Refund Requests"}
            {activeTab === "attendance"  && "QR Attendance"}
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.88rem" }}>
            Welcome back, Admin
          </p>
        </div>

        {feedback && (
          <div style={{ marginBottom: 20 }}>
            <Alert type={feedback.type} message={feedback.message} />
          </div>
        )}

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div>
            {/* stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 32 }}>
              <StatCard label="My Events"          value={myEvents.length}  icon="🗓️" accent={C.cyan}   />
              <StatCard label="Total Registrations" value={totalRegs}        icon="👥" accent={C.yellow} />
              <StatCard label="Active Events"       value={activeEvents}     icon="✅" accent={C.orange} />
            </div>

            {/* events table */}
            <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(2,48,71,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `2px solid ${C.light}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, color: C.dark, fontSize: "1rem" }}>Event Summary</h3>
                <button onClick={() => setActiveTab("create")} style={{ background: C.yellow, color: C.dark, border: 0, borderRadius: 8, padding: "7px 16px", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}>
                  + New Event
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead>
                    <tr style={{ background: "#f0f7fb" }}>
                      {["Event Name","Date","Registrations","Status","Actions"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.dark, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {myEvents.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: "32px", textAlign: "center", color: "#94a3b8" }}>No events yet. Create your first event!</td></tr>
                    ) : myEvents.map((ev, i) => {
                      const count = regCounts[ev._id] ?? 0;
                      const max   = ev.maxRegistrations ?? 100;
                      const open  = new Date(ev.registrationDeadline) > new Date();
                      return (
                        <tr key={ev._id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafcff" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: C.dark }}>{ev.title}</td>
                          <td style={{ padding: "12px 16px", color: "#475569", whiteSpace: "nowrap" }}>{new Date(ev.date).toLocaleDateString()}</td>
                          <td style={{ padding: "12px 16px", minWidth: 160 }}>
                            <span style={{ fontWeight: 600, color: C.dark }}>{count}</span>
                            <span style={{ color: "#94a3b8" }}> / {max}</span>
                            <CapacityBar count={count} max={max} />
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ background: open ? "#dcfce7" : "#fee2e2", color: open ? "#166534" : "#991b1b", borderRadius: 99, padding: "3px 10px", fontSize: "0.78rem", fontWeight: 600 }}>
                              {open ? "Active" : "Closed"}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => handleViewRegs(ev)} style={{ background: C.light, color: C.dark, border: 0, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Registrants</button>
                              <button onClick={() => handleEdit(ev)} style={{ background: C.cyan, color: "#fff", border: 0, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Edit</button>
                              <button onClick={() => setScannerTarget({ eventId: ev._id, eventTitle: ev.title, certificatesEnabled: ev.certificatesEnabled })} style={{ background: "#7c3aed", color: "#fff", border: 0, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>📱 QR</button>
                              <button onClick={() => handleDelete(ev)} style={{ background: C.orange, color: "#fff", border: 0, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── CREATE / EDIT TAB ─────────────────────────────────────────── */}
        {activeTab === "create" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 2px 12px rgba(2,48,71,0.07)", maxWidth: 680 }}>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
              <Field label="Event Title">
                <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Annual Hackathon 2025" style={inputStyle} required />
              </Field>
              <Field label="Description">
                <textarea name="description" value={form.description} onChange={handleChange} placeholder="Describe the event…" style={{ ...inputStyle, minHeight: 90, resize: "vertical" }} required />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Category">
                  <select name="type" value={form.type} onChange={handleChange} style={inputStyle}>
                    {["hackathon","tech","seminar","games","movie","other"].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                  </select>
                </Field>
                <Field label="Location">
                  <input name="location" value={form.location} onChange={handleChange} placeholder="Venue / Room" style={inputStyle} required />
                </Field>
                <Field label="Event Date">
                  <input type="date" name="date" value={form.date} onChange={handleChange} min={new Date().toISOString().split("T")[0]} style={inputStyle} required />
                </Field>
                <Field label="Event Time">
                  <input type="time" name="time" value={form.time} onChange={handleChange} style={inputStyle} required />
                </Field>
                <Field label="Registration Deadline">
                  <input type="datetime-local" name="registrationDeadline" value={form.registrationDeadline} onChange={handleChange} min={new Date().toISOString().slice(0,16)} style={inputStyle} required />
                </Field>
                <Field label="Max Registrations">
                  <input type="number" name="maxRegistrations" value={form.maxRegistrations} onChange={handleChange} min={1} style={inputStyle} required />
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>Set the maximum number of participants</span>
                </Field>
                <Field label="Who can register?">
                  <select name="eligibility" value={form.eligibility} onChange={handleChange} style={inputStyle}>
                    <option value="all">🌍 Open to all colleges</option>
                    <option value="own_college">🏫 My college students only</option>
                  </select>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 2 }}>
                    {form.eligibility === "own_college"
                      ? "Only students from your college can register"
                      : "Students from any college can register"}
                  </span>
                </Field>
              </div>
              <Field label="Tags / Keywords">
                <TagPicker
                  tags={form.tags}
                  onChange={tags => setForm(prev => ({ ...prev, tags }))}
                />
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>
                  Tags help students discover your event via search
                </span>
              </Field>

              {/* ── Banner image ── */}
              <Field label="Event Banner Image">
                <div style={{ display: "grid", gap: 10 }}>
                  {/* Option A: upload from computer */}
                  <div>
                    <label style={{ fontSize: "0.78rem", color: "#64748b", display: "block", marginBottom: 4 }}>
                      📁 Upload from computer (JPG, PNG, WebP — max 5 MB)
                    </label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={e => {
                        const file = e.target.files?.[0] ?? null;
                        setForm(prev => ({ ...prev, imageFile: file, gdriveLink: file ? "" : prev.gdriveLink }));
                      }}
                      style={{ ...inputStyle, padding: "7px 12px", cursor: "pointer" }}
                    />
                    {form.imageFile && (
                      <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#10b981" }}>
                        ✓ {form.imageFile.name} ({(form.imageFile.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>

                  <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>— or —</div>

                  {/* Option B: Google Drive link */}
                  <div>
                    <label style={{ fontSize: "0.78rem", color: "#64748b", display: "block", marginBottom: 4 }}>
                      🔗 Google Drive share link
                    </label>
                    <input
                      type="text"
                      value={form.gdriveLink}
                      onChange={e => setForm(prev => ({ ...prev, gdriveLink: e.target.value, imageFile: e.target.value ? null : prev.imageFile }))}
                      placeholder="https://drive.google.com/file/d/FILE_ID/view"
                      style={inputStyle}
                    />
                    <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                      Share the file publicly in Google Drive, then paste the link here.
                    </p>
                  </div>
                </div>
              </Field>

              {/* ── Payment settings ── */}
              <div style={{ borderTop: "1.5px solid #e2e8f0", paddingTop: 16 }}>
                <h4 style={{ margin: "0 0 12px", color: C.dark, fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 6 }}>
                  💳 Payment Settings
                  <span style={{ background: form.isPaid ? "#dcfce7" : "#f1f5f9", color: form.isPaid ? "#166534" : "#64748b", borderRadius: 99, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
                    {form.isPaid ? "Paid Event" : "Free Event"}
                  </span>
                </h4>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.isPaid}
                      onChange={e => setForm(prev => ({ ...prev, isPaid: e.target.checked }))}
                      style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#059669" }}
                    />
                    <span style={{ fontSize: "0.88rem", fontWeight: 600, color: C.dark }}>This is a paid event</span>
                  </label>
                </div>

                {form.isPaid && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="Registration Fee (₹)">
                      <input
                        type="number"
                        value={form.price}
                        onChange={e => setForm(prev => ({ ...prev, price: Number(e.target.value) || 0 }))}
                        min={1}
                        placeholder="e.g. 199"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="UPI ID">
                      <input
                        value={form.upiId}
                        onChange={e => setForm(prev => ({ ...prev, upiId: e.target.value }))}
                        placeholder="e.g. organiser@upi"
                        style={inputStyle}
                      />
                    </Field>
                    <Field label="QR Code Image (optional)">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => setForm(prev => ({ ...prev, qrImageFile: e.target.files?.[0] ?? null }))}
                        style={{ ...inputStyle, padding: "7px 12px", cursor: "pointer" }}
                      />
                      {form.qrImageFile && (
                        <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#10b981" }}>✓ {form.qrImageFile.name}</p>
                      )}
                    </Field>
                  </div>
                )}
              </div>

              {/* ── Refund Policy ── */}
              <div style={{ borderTop: "1.5px solid #e2e8f0", paddingTop: 16 }}>
                <h4 style={{ margin: "0 0 12px", color: C.dark, fontSize: "0.95rem" }}>↩️ Refund Policy</h4>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={form.refundAllowed}
                      onChange={e => setForm(prev => ({ ...prev, refundAllowed: e.target.checked }))}
                      style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#059669" }}
                    />
                    <span style={{ fontSize: "0.88rem", fontWeight: 600, color: C.dark }}>Allow refunds for this event</span>
                  </label>
                </div>
                {form.refundAllowed && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Field label="Refund Percentage (%)">
                      <input
                        type="number"
                        value={form.refundPercentage}
                        onChange={e => setForm(prev => ({ ...prev, refundPercentage: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                        min={0} max={100}
                        placeholder="e.g. 80"
                        style={inputStyle}
                      />
                      <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>% of paid amount returned</span>
                    </Field>
                    <Field label="Cutoff (hours before event)">
                      <input
                        type="number"
                        value={form.refundCutoffHours}
                        onChange={e => setForm(prev => ({ ...prev, refundCutoffHours: Number(e.target.value) || 48 }))}
                        min={1}
                        placeholder="e.g. 48"
                        style={inputStyle}
                      />
                      <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Must request before this window closes</span>
                    </Field>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="submit" style={{ background: C.dark, color: "#fff", border: 0, borderRadius: 10, padding: "12px 28px", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" }}>
                  {editingId ? "Update Event" : "Create Event"}
                </button>
                {editingId && (
                  <button type="button" onClick={clearForm} style={{ background: "#e2e8f0", color: "#1e293b", border: 0, borderRadius: 10, padding: "12px 20px", fontWeight: 600, cursor: "pointer" }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* ── MY EVENTS TAB ────────────────────────────────────────────── */}
        {activeTab === "events" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 20 }}>
            {events.length === 0 && (
              <p style={{ color: "#94a3b8", gridColumn: "1/-1" }}>No events found.</p>
            )}
            {events.map(ev => {
              const count  = regCounts[ev._id] ?? ev.registrationCount ?? 0;
              const max    = ev.maxRegistrations ?? 100;
              const isOpen = new Date(ev.registrationDeadline) > new Date();
              const isMine = ev.createdBy === user?.id;
              return (
                <div key={ev._id} style={{
                  background: "#fff", borderRadius: 14, overflow: "hidden",
                  boxShadow: "0 2px 12px rgba(2,48,71,0.08)",
                  border: `1px solid ${isMine ? C.light : "#e2e8f0"}`,
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 28px rgba(2,48,71,0.14)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(2,48,71,0.08)"; }}
                >
                  {/* card header */}
                  <div style={{ background: C.dark, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ background: C.yellow, color: C.dark, borderRadius: 99, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 700, textTransform: "capitalize" }}>{ev.type}</span>
                    <span style={{ background: isOpen ? "#dcfce7" : "#fee2e2", color: isOpen ? "#166534" : "#991b1b", borderRadius: 99, padding: "2px 10px", fontSize: "0.75rem", fontWeight: 600 }}>
                      {isOpen ? "Active" : "Closed"}
                    </span>
                  </div>

                  <div style={{ padding: "16px" }}>
                    <h4 style={{ margin: "0 0 6px", color: C.dark, fontSize: "1rem" }}>{ev.title}</h4>
                    {ev.tags && ev.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                        {ev.tags.map(t => (
                          <span key={t} style={{ background: "#eef2ff", color: "#4f46e5", borderRadius: 99, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 600 }}>#{t}</span>
                        ))}
                      </div>
                    )}
                    <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "0.85rem", lineHeight: 1.5 }}>
                      {ev.description?.slice(0, 80)}{(ev.description?.length ?? 0) > 80 ? "…" : ""}
                    </p>
                    <div style={{ display: "flex", gap: 12, fontSize: "0.8rem", color: "#94a3b8", marginBottom: 12, flexWrap: "wrap" }}>
                      <span>📅 {new Date(ev.date).toLocaleDateString()}</span>
                      <span>⏰ {ev.time}</span>
                      <span>📍 {ev.location}</span>
                    </div>

                    <CapacityBar count={count} max={max} />

                    {/* avg rating for past events */}
                    {new Date(ev.date) < new Date() && ev.avgRating != null && ev.avgRating > 0 && (
                      <div style={{ fontSize: "0.78rem", color: "#FFB703", fontWeight: 600, marginTop: 8 }}>
                        {"★".repeat(Math.round(ev.avgRating))}{"☆".repeat(5 - Math.round(ev.avgRating))}
                        <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: 4 }}>{ev.avgRating.toFixed(1)} ({ev.feedbackCount} reviews)</span>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      <button onClick={() => handleViewRegs(ev)} style={{ flex: 1, background: C.light, color: C.dark, border: 0, borderRadius: 8, padding: "8px", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>
                        👥 Registrants
                      </button>
                      {/* Show feedback button only for past events owned by this admin */}
                      {isMine && new Date(ev.date) < new Date() && (
                        <button onClick={() => void handleViewFeedback(ev)} style={{ background: "#FFB703", color: C.dark, border: 0, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>
                          ⭐ Feedback
                        </button>
                      )}
                      {isMine && (
                        <>
                          <button onClick={() => void openQa(ev)} style={{ background: "#eef2ff", color: "#4f46e5", border: 0, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>
                            💬 Q&A
                          </button>
                          <button onClick={() => handleEdit(ev)} style={{ background: C.cyan, color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>Edit</button>
                          <button onClick={() => handleDelete(ev)} style={{ background: C.orange, color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: "0.82rem" }}>Delete</button>
                        </>
                      )}
                    </div>
                    {!isMine && <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Created by another admin</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── PAYMENTS TAB ─────────────────────────────────────────────── */}
        {activeTab === "payments" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>
                Review and verify student payment submissions for paid events.
              </p>
              <button onClick={() => void loadPendingPayments()}
                style={{ background: C.light, color: C.dark, border: 0, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: "0.83rem" }}>
                🔄 Refresh
              </button>
            </div>

            {paymentsLoading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>Loading payments…</div>
            ) : pendingPayments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>✅</div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem" }}>No pending payments</p>
                <p style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>All payments have been verified.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {pendingPayments.map((reg: any) => {
                  const student = reg.userId && typeof reg.userId === "object" ? reg.userId : null;
                  const event   = reg.eventId && typeof reg.eventId === "object" ? reg.eventId : null;
                  const isActing = paymentActionLoading === reg._id;
                  const screenshotUrl = reg.paymentScreenshot
                    ? `${API_BASE}${reg.paymentScreenshot}`
                    : null;
                  return (
                    <div key={reg._id} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(2,48,71,0.08)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                      {/* Card header */}
                      <div style={{ background: "#fef3c7", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "#92400e", fontSize: "0.95rem" }}>
                            💳 {event?.title || "Unknown Event"}
                          </span>
                          <span style={{ background: "#FEF3C7", color: "#d97706", borderRadius: 99, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700, marginLeft: 10, border: "1px solid #fcd34d" }}>
                            PENDING
                          </span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#059669" }}>
                          ₹{event?.price || 0}
                        </span>
                      </div>

                      <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "start" }}>
                        <div>
                          {/* Student info */}
                          <div style={{ marginBottom: 12 }}>
                            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: "0.92rem", color: C.dark }}>
                              {student?.name || "Unknown Student"}
                            </p>
                            <p style={{ margin: "0 0 2px", color: "#64748b", fontSize: "0.83rem" }}>{student?.email || ""}</p>
                            {student?.collegeName && <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.78rem" }}>🏫 {student.collegeName}</p>}
                          </div>

                          {/* Transaction ID */}
                          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                            <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>Transaction ID</p>
                            <p style={{ margin: "2px 0 0", fontFamily: "monospace", fontSize: "0.88rem", color: "#0369a1", fontWeight: 700 }}>
                              {reg.transactionId || "Not provided"}
                            </p>
                          </div>

                          {/* Rejection reason input */}
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>
                              Rejection reason (optional)
                            </label>
                            <input
                              value={rejectReason[reg._id] ?? ""}
                              onChange={e => setRejectReason(prev => ({ ...prev, [reg._id]: e.target.value }))}
                              placeholder="e.g. Screenshot unclear, wrong amount…"
                              style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: "0.83rem", outline: "none" }}
                            />
                          </div>

                          {/* Action buttons */}
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => void handleApprovePayment(reg._id)} disabled={isActing}
                              style={{ flex: 1, background: "#059669", color: "#fff", border: 0, borderRadius: 9, padding: "10px", fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", fontSize: "0.88rem", opacity: isActing ? 0.6 : 1 }}>
                              {isActing ? "Processing…" : "✅ Approve"}
                            </button>
                            <button onClick={() => void handleRejectPayment(reg._id)} disabled={isActing}
                              style={{ flex: 1, background: "#dc2626", color: "#fff", border: 0, borderRadius: 9, padding: "10px", fontWeight: 700, cursor: isActing ? "not-allowed" : "pointer", fontSize: "0.88rem", opacity: isActing ? 0.6 : 1 }}>
                              {isActing ? "…" : "❌ Reject"}
                            </button>
                          </div>
                        </div>

                        {/* Screenshot preview */}
                        {screenshotUrl && (
                          <div>
                            <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>Screenshot</p>
                            <a href={screenshotUrl} target="_blank" rel="noreferrer">
                              <img
                                src={screenshotUrl}
                                alt="Payment screenshot"
                                style={{ width: 140, height: 140, objectFit: "cover", borderRadius: 10, border: "1.5px solid #e2e8f0", cursor: "pointer", transition: "transform 0.2s" }}
                                onMouseEnter={e => { (e.target as HTMLImageElement).style.transform = "scale(1.04)"; }}
                                onMouseLeave={e => { (e.target as HTMLImageElement).style.transform = ""; }}
                              />
                            </a>
                            <p style={{ margin: "4px 0 0", fontSize: "0.7rem", color: "#94a3b8", textAlign: "center" }}>Click to view full</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── REFUNDS TAB ──────────────────────────────────────────────── */}
        {activeTab === "refunds" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.9rem" }}>Review and process student refund requests.</p>
              <button onClick={() => void loadPendingRefunds()}
                style={{ background: C.light, color: C.dark, border: 0, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontWeight: 600, fontSize: "0.83rem" }}>
                🔄 Refresh
              </button>
            </div>
            {refundsLoading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>Loading refunds…</div>
            ) : pendingRefunds.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>✅</div>
                <p style={{ margin: 0, fontWeight: 600 }}>No pending refund requests</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {pendingRefunds.map((reg: any) => {
                  const student   = reg.userId && typeof reg.userId === "object" ? reg.userId : null;
                  const event     = reg.eventId && typeof reg.eventId === "object" ? reg.eventId : null;
                  const isActing  = refundActionLoading === reg._id;
                  return (
                    <div key={reg._id} style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 12px rgba(2,48,71,0.08)", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                      <div style={{ background: "#eff6ff", padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <span style={{ fontWeight: 700, color: "#1d4ed8", fontSize: "0.95rem" }}>↩️ {event?.title || "Unknown Event"}</span>
                          <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 99, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700, marginLeft: 10, border: "1px solid #bfdbfe" }}>REFUND REQUESTED</span>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#059669" }}>₹{reg.refundAmount}</span>
                      </div>
                      <div style={{ padding: "16px 18px" }}>
                        <p style={{ margin: "0 0 4px", fontWeight: 700, color: C.dark }}>{student?.name}</p>
                        <p style={{ margin: "0 0 12px", fontSize: "0.83rem", color: "#64748b" }}>{student?.email} · {student?.collegeName}</p>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Rejection reason (optional)</label>
                          <input
                            value={refundRejectReason[reg._id] ?? ""}
                            onChange={e => setRefundRejectReason(prev => ({ ...prev, [reg._id]: e.target.value }))}
                            placeholder="Reason for rejection…"
                            style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: "0.83rem", outline: "none" }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => void handleApproveRefund(reg._id)} disabled={isActing}
                            style={{ flex: 1, background: "#059669", color: "#fff", border: 0, borderRadius: 9, padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem", opacity: isActing ? 0.6 : 1 }}>
                            {isActing ? "Processing…" : "✅ Approve Refund"}
                          </button>
                          <button onClick={() => void handleRejectRefund(reg._id)} disabled={isActing}
                            style={{ flex: 1, background: "#dc2626", color: "#fff", border: 0, borderRadius: 9, padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem", opacity: isActing ? 0.6 : 1 }}>
                            {isActing ? "…" : "❌ Reject"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ATTENDANCE TAB ────────────────────────────────────────────── */}
        {activeTab === "attendance" && (
          <div>
            <p style={{ marginBottom: 20, color: "#64748b", fontSize: "0.9rem" }}>
              Select an event to open the QR scanner and mark attendance.
            </p>
            {myEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: "3rem", marginBottom: 12 }}>📱</div>
                <p style={{ margin: 0, fontWeight: 600 }}>No events to scan for</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
                {myEvents.map(ev => (
                  <div key={ev._id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: "16px 18px", boxShadow: "0 2px 8px rgba(2,48,71,0.06)" }}>
                    <p style={{ margin: "0 0 4px", fontWeight: 700, color: C.dark, fontSize: "0.95rem" }}>{ev.title}</p>
                    <p style={{ margin: "0 0 12px", fontSize: "0.8rem", color: "#64748b" }}>
                      📅 {new Date(ev.date).toLocaleDateString()} · 📍 {ev.location}
                    </p>
                    {ev.certificatesEnabled && (
                      <span style={{ background: "#f3e8ff", color: "#7c3aed", borderRadius: 99, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700, display: "inline-block", marginBottom: 10 }}>
                        🏆 Certificates Active
                      </span>
                    )}
                    <button
                      onClick={() => setScannerTarget({ eventId: ev._id, eventTitle: ev.title, certificatesEnabled: ev.certificatesEnabled })}
                      style={{ width: "100%", background: "linear-gradient(135deg,#023047,#1e3a5f)", color: "#fff", border: 0, borderRadius: 9, padding: "10px", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}
                    >
                      📱 Open QR Scanner
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── QR SCANNER MODAL ─────────────────────────────────────────────── */}
      {scannerTarget && (
        <QrScannerModal
          eventId={scannerTarget.eventId}
          eventTitle={scannerTarget.eventTitle}
          certificatesEnabled={scannerTarget.certificatesEnabled}
          onClose={() => setScannerTarget(null)}
        />
      )}

      {/* ── REGISTRANTS MODAL ────────────────────────────────────────────── */}
      {viewEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,48,71,0.55)", display: "grid", placeItems: "center", padding: 16, zIndex: 50, backdropFilter: "blur(4px)" }}
          onClick={() => setViewEvent(null)}>
          <div style={{ width: "min(700px,100%)", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(2,48,71,0.25)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: C.dark }}>{viewEvent.title}</h3>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>{viewRegs.length} registrant(s)</p>
              </div>
              <button onClick={() => setViewEvent(null)} style={{ background: "#f1f5f9", border: 0, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 600, color: "#475569" }}>✕ Close</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {viewRegs.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>No registrations yet.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.87rem" }}>
                  <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
                    <tr style={{ borderBottom: `2px solid ${C.light}` }}>
                      {["Name","College ID","College","Department"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.dark, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewRegs.map((r, i) => (
                      <tr key={r._id || i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={{ padding: "10px 12px", color: "#334155" }}>{r.name || "N/A"}</td>
                        <td style={{ padding: "10px 12px", color: "#475569" }}>{r.collegeId || "N/A"}</td>
                        <td style={{ padding: "10px 12px", color: "#475569" }}>{r.collegeName || "N/A"}</td>
                        <td style={{ padding: "10px 12px", color: "#475569" }}>{r.department || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FEEDBACK MODAL ───────────────────────────────────────────────── */}
      {feedbackEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,48,71,0.55)", display: "grid", placeItems: "center", padding: 16, zIndex: 50, backdropFilter: "blur(4px)" }}
          onClick={() => setFeedbackEvent(null)}>
          <div style={{ width: "min(700px,100%)", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(2,48,71,0.25)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: C.dark }}>⭐ Feedback — {feedbackEvent.title}</h3>
                {feedbackData && (
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                    Avg: <strong style={{ color: "#FFB703" }}>{"★".repeat(Math.round(feedbackData.avgRating))}{"☆".repeat(5 - Math.round(feedbackData.avgRating))} {feedbackData.avgRating.toFixed(1)}</strong>
                    &nbsp;·&nbsp;{feedbackData.feedbackCount} response(s)
                  </p>
                )}
              </div>
              <button onClick={() => setFeedbackEvent(null)} style={{ background: "#f1f5f9", border: 0, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 600, color: "#475569" }}>✕ Close</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {feedbackLoading ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>Loading feedback…</div>
              ) : !feedbackData || feedbackData.feedbacks.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>No feedback submitted yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {feedbackData.feedbacks.map((fb, i) => {
                    const u = typeof fb.userId === "object" ? fb.userId : null;
                    return (
                      <div key={fb._id || i} style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 16px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <div>
                            <span style={{ fontWeight: 600, color: C.dark, fontSize: "0.9rem" }}>{u?.name || "Anonymous"}</span>
                            {u?.collegeName && <span style={{ color: "#94a3b8", fontSize: "0.78rem", marginLeft: 8 }}>{u.collegeName}</span>}
                          </div>
                          <span style={{ color: "#FFB703", fontSize: "1rem", letterSpacing: 2 }}>
                            {"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}
                          </span>
                        </div>
                        {fb.comment && <p style={{ margin: 0, color: "#475569", fontSize: "0.88rem", lineHeight: 1.5 }}>{fb.comment}</p>}
                        <p style={{ margin: "6px 0 0", color: "#94a3b8", fontSize: "0.75rem" }}>{new Date(fb.submittedAt).toLocaleDateString()}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL EVENT MODAL ───────────────────────────────────────────── */}
      {cancelTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,48,71,0.6)", display: "grid", placeItems: "center", padding: 16, zIndex: 50, backdropFilter: "blur(4px)" }}
          onClick={() => !cancelLoading && setCancelTarget(null)}>
          <div style={{ width: "min(480px,100%)", background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 24px 60px rgba(2,48,71,0.3)" }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ background: "#fee2e2", borderRadius: 10, padding: "10px 12px", fontSize: "1.4rem" }}>🚫</div>
              <div>
                <h3 style={{ margin: 0, color: C.dark, fontSize: "1.1rem" }}>Cancel Event</h3>
                <p style={{ margin: "3px 0 0", color: "#64748b", fontSize: "0.85rem" }}>{cancelTarget.title}</p>
              </div>
            </div>

            {/* Warning */}
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 20, fontSize: "0.85rem", color: "#991b1b" }}>
              ⚠️ This will <strong>permanently delete</strong> the event and send a cancellation email to all {regCounts[cancelTarget._id] ?? 0} registered student(s).
            </div>

            {/* Reason input */}
            <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: C.dark, marginBottom: 6 }}>
              Reason for cancellation <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional — shown in the email)</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Venue unavailable, insufficient registrations, rescheduled…"
              rows={3}
              style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 9, padding: "10px 12px", fontSize: "0.9rem", outline: "none", resize: "vertical", marginBottom: 20 }}
            />

            {/* Actions */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={cancelLoading}
                style={{ flex: 1, background: "#dc2626", color: "#fff", border: 0, borderRadius: 10, padding: "12px", fontWeight: 700, cursor: "pointer", fontSize: "0.95rem" }}
              >
                {cancelLoading ? "Cancelling & notifying…" : "Cancel Event & Notify Students"}
              </button>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelLoading}
                style={{ background: "#e2e8f0", color: "#1e293b", border: 0, borderRadius: 10, padding: "12px 18px", fontWeight: 600, cursor: "pointer" }}
              >
                Keep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Q&A MODAL ─────────────────────────────────────────────────────── */}
      {qaEvent && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(2,48,71,0.55)", display: "grid", placeItems: "center", padding: 16, zIndex: 50, backdropFilter: "blur(4px)" }}
          onClick={() => setQaEvent(null)}>
          <div style={{ width: "min(640px,100%)", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 24px 60px rgba(2,48,71,0.25)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: C.dark }}>💬 Q&A — {qaEvent.title}</h3>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.85rem" }}>
                  {qaComments.length} question{qaComments.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={() => setQaEvent(null)} style={{ background: "#f1f5f9", border: 0, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 600, color: "#475569" }}>✕ Close</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {qaLoading ? (
                <p style={{ color: "#94a3b8", textAlign: "center", padding: "32px 0" }}>Loading questions…</p>
              ) : qaComments.length === 0 ? (
                <p style={{ color: "#94a3b8", textAlign: "center", padding: "32px 0" }}>No questions yet.</p>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  {qaComments.map(c => {
                    const author = typeof c.userId === "object" ? c.userId : null;
                    return (
                      <div key={c._id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                        {/* Question */}
                        <div style={{ background: "#f8fafc", padding: "12px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: C.dark }}>{author?.name ?? "Student"}</span>
                                {author?.collegeName && <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>{author.collegeName}</span>}
                                <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155", lineHeight: 1.5 }}>{c.text}</p>
                            </div>
                            <button type="button" onClick={() => void handleAdminDeleteComment(c._id, qaEvent._id)}
                              style={{ background: "none", border: 0, color: "#ef4444", cursor: "pointer", fontSize: "0.8rem", padding: "2px 6px", flexShrink: 0 }}>✕</button>
                          </div>
                        </div>

                        {/* Existing replies */}
                        {c.replies?.length > 0 && (
                          <div style={{ padding: "10px 14px", background: "#f0fdf4", borderTop: "1px solid #bbf7d0" }}>
                            {c.replies.map(r => (
                              <div key={r._id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                    <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "#166534" }}>You (Admin)</span>
                                    <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: "0.87rem", color: "#166534", lineHeight: 1.5 }}>{r.text}</p>
                                </div>
                                <button type="button" onClick={() => void handleAdminDeleteComment(r._id, qaEvent._id)}
                                  style={{ background: "none", border: 0, color: "#ef4444", cursor: "pointer", fontSize: "0.8rem", padding: "2px 6px", flexShrink: 0 }}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply input — only if no reply yet */}
                        {(!c.replies || c.replies.length === 0) && (
                          <div style={{ padding: "10px 14px", borderTop: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
                            <input
                              value={replyInputs[c._id] ?? ""}
                              onChange={e => setReplyInputs(prev => ({ ...prev, [c._id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAdminReply(qaEvent._id, c._id); } }}
                              placeholder="Type your answer…"
                              style={{ flex: 1, border: "1.5px solid #cde8f5", borderRadius: 8, padding: "8px 12px", fontSize: "0.85rem", outline: "none" }}
                            />
                            <button type="button"
                              onClick={() => void handleAdminReply(qaEvent._id, c._id)}
                              disabled={qaSubmitting === c._id || !(replyInputs[c._id] ?? "").trim()}
                              style={{ background: C.dark, color: C.yellow, border: 0, borderRadius: 8, padding: "0 16px", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                              {qaSubmitting === c._id ? "…" : "Answer"}
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

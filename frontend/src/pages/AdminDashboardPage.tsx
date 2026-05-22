import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Alert from "../components/Alert";
import { useAuth } from "../context/AuthContext";
import { createEvent, deleteEvent, getEvents, updateEvent } from "../services/eventService";
import { getEventRegistrations } from "../services/registrationService";
import { getEventFeedback } from "../services/feedbackService";
import { getComments, addComment, deleteComment } from "../services/commentService";
import type { EventItem, FeedbackItem, CommentItem } from "../types";

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

  const [activeTab, setActiveTab]   = useState<"overview" | "create" | "events">("overview");
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

  useEffect(() => { void loadEvents(); }, []);

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
  const NavItem = ({ id, icon, label }: { id: typeof activeTab; icon: string; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 16px", borderRadius: 10, border: 0, cursor: "pointer",
        width: "100%", textAlign: "left", fontSize: "0.9rem", fontWeight: 600,
        background: activeTab === id ? C.yellow : "transparent",
        color: activeTab === id ? C.dark : "rgba(255,255,255,0.8)",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <span style={{ fontSize: "1.1rem" }}>{icon}</span> {label}
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
          <NavItem id="overview" icon="📊" label="Overview" />
          <NavItem id="create"   icon="➕" label="Create Event" />
          <NavItem id="events"   icon="📋" label="My Events" />
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
            {activeTab === "overview" && "Dashboard Overview"}
            {activeTab === "create"   && (editingId ? "Update Event" : "Create New Event")}
            {activeTab === "events"   && "My Events"}
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

        {/* ── CHECK-IN SCANNER TAB ─────────────────────────────────────── */}
        {activeTab === "checkin" && (
          <div style={{ maxWidth: 520 }}>
            <div style={{ background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 2px 12px rgba(2,48,71,0.07)", marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 6px", color: C.dark }}>📷 Scan Student QR Code</h3>
              <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: "0.88rem" }}>
                Ask the student to open their QR code in the app. Paste or type the token below to check them in.
              </p>

              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={scanInput}
                  onChange={e => { setScanInput(e.target.value); setScanResult(null); }}
                  onKeyDown={e => { if (e.key === "Enter") void handleCheckIn(); }}
                  placeholder="Paste QR token here…"
                  style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: "0.82rem" }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => void handleCheckIn()}
                  disabled={scanLoading || !scanInput.trim()}
                  style={{ background: C.dark, color: C.yellow, border: 0, borderRadius: 9, padding: "0 20px", fontWeight: 700, cursor: "pointer", fontSize: "0.9rem", whiteSpace: "nowrap" }}
                >
                  {scanLoading ? "Checking…" : "✓ Check In"}
                </button>
              </div>

              {/* Result card */}
              {scanResult && (
                <div style={{
                  marginTop: 20, borderRadius: 10, padding: "16px 18px",
                  background: scanResult.success ? "#dcfce7" : "#fef2f2",
                  border: `1.5px solid ${scanResult.success ? "#86efac" : "#fecaca"}`,
                }}>
                  <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: "1rem", color: scanResult.success ? "#166534" : "#991b1b" }}>
                    {scanResult.success ? "✅" : "❌"} {scanResult.msg}
                  </p>
                  {scanResult.student && (
                    <div style={{ fontSize: "0.85rem", color: "#334155", display: "grid", gap: 3 }}>
                      <span><strong>Name:</strong> {scanResult.student.name || "N/A"}</span>
                      <span><strong>College:</strong> {scanResult.student.collegeName || "N/A"}</span>
                      {scanResult.student.department && <span><strong>Dept:</strong> {scanResult.student.department}</span>}
                      {scanResult.event && <span><strong>Event:</strong> {scanResult.event.title}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ background: "#fff", borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(2,48,71,0.07)" }}>
              <h4 style={{ margin: "0 0 10px", color: C.dark, fontSize: "0.95rem" }}>How it works</h4>
              <ol style={{ margin: 0, paddingLeft: 20, color: "#64748b", fontSize: "0.85rem", lineHeight: 2 }}>
                <li>Student opens their <strong>My Registrations</strong> tab in the app</li>
                <li>They click <strong>📱 My QR</strong> on the event card</li>
                <li>They show the QR code on their screen</li>
                <li>You paste the token here (or use a QR scanner app that copies to clipboard)</li>
                <li>Hit <strong>Check In</strong> — attendance is marked instantly</li>
              </ol>
            </div>
          </div>
        )}
      </main>

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

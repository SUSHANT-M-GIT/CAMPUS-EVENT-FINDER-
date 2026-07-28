import { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";

const TYPE_ICON: Record<string, string> = {
  success: "",
  error:   "",
  payment: "",
  warning: "",
  info:    "",
};
const TYPE_BG: Record<string, string> = {
  success: "#f0fdf4",
  error:   "#fef2f2",
  payment: "#fffbeb",
  warning: "#fffbeb",
  info:    "#eef2ff",
};

function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)   return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearNotifications } = useSocket();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen(o => !o);
    if (!open && unreadCount > 0) markAllRead();
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        style={{
          position: "relative", width: 36, height: 36, borderRadius: "50%",
          background: open ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: "1rem", color: "#fff",
          transition: "background 0.2s",
        }}
      >
        
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            background: "linear-gradient(135deg,#ef4444,#dc2626)",
            color: "#fff", borderRadius: "50%",
            width: 17, height: 17, fontSize: "0.6rem", fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid rgba(15,12,41,0.95)",
            animation: "bounceIn 0.3s ease",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="notif-panel anim-scale-in">
          {/* Header */}
          <div className="notif-header">
            <div>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span style={{ marginLeft: 8, background: "linear-gradient(135deg,#4f46e5,#8b5cf6)", color: "#fff", borderRadius: 99, padding: "1px 8px", fontSize: "0.68rem", fontWeight: 700 }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {notifications.length > 0 && (
                <>
                  <button type="button" onClick={markAllRead}
                    style={{ background: "none", border: 0, color: "#6366f1", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}>
                    Mark all read
                  </button>
                  <button type="button" onClick={clearNotifications}
                    style={{ background: "none", border: 0, color: "var(--text-dim)", fontSize: "0.75rem", cursor: "pointer" }}>
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {/* List */}
          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <div className="notif-empty-icon"></div>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--text-2)" }}>All caught up!</p>
                <p style={{ margin: "4px 0 0", fontSize: "0.8rem" }}>No new notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`notif-item${n.read ? "" : " unread"}`}
                  style={{ background: n.read ? undefined : TYPE_BG[n.type] || "#eef2ff" }}
                >
                  <div className="notif-icon">{TYPE_ICON[n.type] || ""}</div>
                  <div className="notif-body">
                    <p>{n.message}</p>
                    <time>{timeAgo(n.createdAt)}</time>
                  </div>
                  {!n.read && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4f46e5", flexShrink: 0, marginTop: 6 }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


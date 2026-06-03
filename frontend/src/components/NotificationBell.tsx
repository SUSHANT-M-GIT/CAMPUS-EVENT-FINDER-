/**
 * NotificationBell.tsx
 * Displays a bell icon with unread count badge.
 * On click shows a dropdown panel of recent notifications.
 */
import { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext";

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearNotifications } = useSocket();
  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const typeColor = (type: string) => {
    if (type === "success") return "#dcfce7";
    if (type === "error")   return "#fee2e2";
    if (type === "payment") return "#fef3c7";
    return "#eef2ff";
  };
  const typeIcon = (type: string) => {
    if (type === "success") return "✅";
    if (type === "error")   return "❌";
    if (type === "payment") return "💳";
    return "🔔";
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open && unreadCount > 0) markAllRead(); }}
        style={{
          position: "relative", background: "rgba(255,255,255,0.1)", border: "none",
          borderRadius: 10, padding: "8px 10px", cursor: "pointer",
          fontSize: "1.2rem", lineHeight: 1, color: "#fff",
          transition: "background 0.2s",
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            background: "#EF233C", color: "#fff",
            borderRadius: "50%", width: 18, height: 18,
            fontSize: "0.65rem", fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 320, maxHeight: 400, overflowY: "auto",
          background: "#fff", borderRadius: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
          zIndex: 200, border: "1px solid #e2e8f0",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#1e293b" }}>Notifications</span>
            {notifications.length > 0 && (
              <button type="button" onClick={clearNotifications}
                style={{ background: "none", border: 0, color: "#94a3b8", fontSize: "0.75rem", cursor: "pointer", fontWeight: 600 }}>
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          {notifications.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: "0.85rem" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>🔕</div>
              No notifications yet
            </div>
          ) : (
            <div>
              {notifications.map(n => (
                <div key={n.id} style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid #f8fafc",
                  background: n.read ? "#fff" : typeColor(n.type),
                  transition: "background 0.3s",
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>{typeIcon(n.type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "0.83rem", color: "#334155", lineHeight: 1.4, wordBreak: "break-word" }}>
                        {n.message}
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                        {n.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

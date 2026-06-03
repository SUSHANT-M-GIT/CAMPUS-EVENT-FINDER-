/**
 * SocketContext.tsx
 * Provides a single Socket.IO connection shared across the app.
 * Automatically joins the user's personal room after login.
 */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "payment";
  read: boolean;
  createdAt: Date;
}

interface SocketContextValue {
  socket: Socket | null;
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

const BACKEND_URL = "http://127.0.0.1:5000";

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (message: string, type: Notification["type"] = "info") => {
    setNotifications(prev => [
      {
        id:        `${Date.now()}-${Math.random()}`,
        message,
        type,
        read:      false,
        createdAt: new Date(),
      },
      ...prev.slice(0, 49), // keep max 50
    ]);
  };

  useEffect(() => {
    // Connect once
    const socket = io(BACKEND_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (isAuthenticated && user?.id) {
        socket.emit("join", user.id);
      }
    });

    // ── New event broadcast ──────────────────────────────────────────────────
    socket.on("newEvent", (data: { message: string }) => {
      addNotification(data.message, "info");
    });

    // ── Payment status notifications (personal room) ─────────────────────────
    socket.on("paymentApproved", (data: { message: string }) => {
      addNotification(data.message, "success");
    });

    socket.on("paymentRejected", (data: { message: string }) => {
      addNotification(data.message, "error");
    });

    socket.on("paymentSubmitted", (data: { studentName: string; eventTitle: string }) => {
      addNotification(
        `💳 New payment from ${data.studentName || "a student"} for "${data.eventTitle}"`,
        "payment"
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-join rooms when user changes (login / logout)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (isAuthenticated && user?.id) {
      socket.emit("join", user.id);
    }
  }, [isAuthenticated, user?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () =>
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

  const clearNotifications = () => setNotifications([]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, notifications, unreadCount, markAllRead, clearNotifications }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}

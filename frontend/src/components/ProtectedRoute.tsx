import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  role: "admin" | "student";
  children: ReactNode;
}

/**
 * Guards a route by role.
 * - Unauthenticated users → /login
 * - Wrong role → redirected to their own dashboard
 */
export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    // Students trying to hit /admin go to /user, and vice versa
    return <Navigate to={user.role === "admin" ? "/admin" : "/user"} replace />;
  }

  return <>{children}</>;
}

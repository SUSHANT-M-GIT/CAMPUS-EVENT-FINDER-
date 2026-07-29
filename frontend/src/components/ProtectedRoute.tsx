import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  role: "admin" | "student" | "professional";
  children: ReactNode;
}

export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  // professionals share the student dashboard
  const effectiveRole = user.role === "professional" ? "student" : user.role;
  const requiredRole  = role === "professional" ? "student" : role;

  if (effectiveRole !== requiredRole) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/user"} replace />;
  }

  return <>{children}</>;
}

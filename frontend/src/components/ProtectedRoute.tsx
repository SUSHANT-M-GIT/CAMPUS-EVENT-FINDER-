import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  role: "admin" | "student";
  children: ReactNode;
}

export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const storedUser = localStorage.getItem("user");
  if (!storedUser) {
    return <Navigate to="/login" replace />;
  }

  let userRole: "admin" | "student" | "user" | "" = "";
  try {
    userRole = String(JSON.parse(storedUser).role || "") as "admin" | "student" | "user" | "";
  } catch {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = userRole === "user" ? "student" : userRole;
  if (normalizedRole !== role) {
    return <Navigate to={normalizedRole === "admin" ? "/admin" : "/user"} replace />;
  }

  return <>{children}</>;
}

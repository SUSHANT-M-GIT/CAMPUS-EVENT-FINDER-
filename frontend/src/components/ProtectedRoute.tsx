import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardPath } from '../utils/dashboard';

interface ProtectedRouteProps {
  role: 'admin' | 'student' | 'professional' | 'individual' | 'authenticated';
  children: ReactNode;
}

export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;

  if (role === 'authenticated') return <>{children}</>;

  if (user.role !== role) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return <>{children}</>;
}

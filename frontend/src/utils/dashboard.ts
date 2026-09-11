import type { UserRole } from '../types';

export function getDashboardPath(role?: UserRole | string): '/admin' | '/user' | '/professional' | '/individual' {
  if (role === 'admin') return '/admin';
  if (role === 'individual') return '/individual';
  if (role === 'professional') return '/professional';
  return '/user';
}

export function getDashboardLabel(role?: UserRole | string): string {
  if (role === 'admin') return 'Admin Dashboard';
  if (role === 'individual') return 'Individual Dashboard';
  if (role === 'professional') return 'Professional Dashboard';
  return 'Student Dashboard';
}
import api from './api';
import type { AuthUser } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}
export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  role?: string;
  collegeName?: string;
  collegeId?: string;
  company?: string;
  designation?: string;
  phone?: string;
}

export async function login(payload: LoginPayload) {
  const { data } = await api.post<{ token?: string }>('/auth/login', payload);
  return data;
}

export async function signup(payload: SignupPayload) {
  const { data } = await api.post<{ success: boolean; msg: string; email: string }>(
    '/auth/register',
    payload
  );
  return data;
}

export async function verifyEmail(email: string, otp: string) {
  const { data } = await api.post<{ msg: string; pendingApproval?: boolean }>('/auth/verify-email', { email, otp });
  return data;
}

export async function resendOtp(email: string) {
  const { data } = await api.post<{ success: boolean; msg: string }>('/auth/resend-otp', { email });
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await api.post<{ success: boolean; msg: string }>('/auth/forgot-password', {
    email,
  });
  return data;
}

export interface ResetPasswordPayload {
  email: string;
  token: string;
  password: string;
}

export async function resetPassword(payload: ResetPasswordPayload) {
  const { data } = await api.post<{ success: boolean; msg: string }>(
    '/auth/reset-password',
    payload
  );
  return data;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(payload: ChangePasswordPayload) {
  const { data } = await api.post<{ success: boolean; msg: string }>('/auth/change-password', payload);
  return data;
}

export interface GoogleAuthPayload {
  idToken: string;
  role?: 'student' | 'professional' | 'admin';
  collegeName?: string;
  collegeId?: string;
  company?: string;
  designation?: string;
  phone?: string;
}

export interface GoogleAuthResponse {
  token?: string;
  isNewUser?: boolean;
  needsProfileCompletion?: boolean;
  needsCollegeName?: boolean;
  pendingApproval?: boolean;
  msg?: string;
  googleEmail?: string;
  googleName?: string;
  role?: 'student' | 'professional' | 'admin';
}

export async function googleAuth(payload: GoogleAuthPayload) {
  const { data } = await api.post<GoogleAuthResponse>('/auth/google', payload);
  return data;
}

export interface MicrosoftAuthPayload {
  accessToken?: string;
  idToken?: string;
  role?: 'student' | 'professional' | 'admin';
  collegeName?: string;
  collegeId?: string;
  company?: string;
  designation?: string;
  phone?: string;
}

export interface MicrosoftAuthResponse {
  token?: string;
  isNewUser?: boolean;
  needsProfileCompletion?: boolean;
  pendingApproval?: boolean;
  msg?: string;
  msEmail?: string;
  msName?: string;
  role?: 'student' | 'professional' | 'admin';
  provider?: string;
}

export async function microsoftAuth(payload: MicrosoftAuthPayload) {
  const { data } = await api.post<MicrosoftAuthResponse>('/auth/microsoft', payload);
  return data;
}

export async function fetchCurrentUser() {
  const { data } = await api.get<AuthUser>('/auth/me');
  return data;
}
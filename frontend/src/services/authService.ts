import api from "./api";

export interface LoginPayload  { email: string; password: string; }
export interface SignupPayload { name: string; email: string; password: string; role?: string; collegeName: string; }

export async function login(payload: LoginPayload) {
  const { data } = await api.post<{ token: string }>("/auth/login", payload);
  return data;
}

export async function signup(payload: SignupPayload) {
  const { data } = await api.post<{ success: boolean; msg: string; email: string }>("/auth/register", payload);
  return data;
}

export async function verifyEmail(email: string, otp: string) {
  const { data } = await api.post<{ msg: string }>("/auth/verify-email", { email, otp });
  return data;
}

export async function resendOtp(email: string) {
  const { data } = await api.post<{ success: boolean; msg: string }>("/auth/resend-otp", { email });
  return data;
}

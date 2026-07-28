import api from "./api";
import type { RegistrationItem } from "../types";

export interface RegistrationPayload {
  name: string;
  collegeId: string;
  collegeName: string;
  department: string;
}

export interface RegisterResponse {
  msg: string;
  status: "confirmed" | "waitlisted";
  waitlistPosition?: number | null;
  paymentStatus?: "free" | "pending" | "approved" | "rejected";
  isPaid?: boolean;
  registrationId?: string;
  requested?: boolean;
}

export async function registerForEvent(eventId: string, payload?: RegistrationPayload) {
  const { data } = await api.post<RegisterResponse>(`/registrations/${eventId}`, payload ?? {});
  return data;
}

export async function cancelRegistration(eventId: string) {
  const { data } = await api.delete<{ msg: string; requested?: boolean }>(`/registrations/${eventId}`);
  return data;
}

export async function getMyRegistrations() {
  const { data } = await api.get<RegistrationItem[]>("/my-registrations");
  return data;
}

export async function getEventRegistrations(eventId: string) {
  const { data } = await api.get<RegistrationItem[]>(`/event/${eventId}/registrations`);
  return data;
}

// Admin: cancellation management
export async function getPendingCancellations() {
  const { data } = await api.get<any[]>("/cancellations/pending");
  return data;
}

export async function approveCancellation(registrationId: string) {
  const { data } = await api.put<{ msg: string }>(`/cancellations/${registrationId}/approve`);
  return data;
}

export async function rejectCancellation(registrationId: string, reason?: string) {
  const { data } = await api.put<{ msg: string }>(`/cancellations/${registrationId}/reject`, { reason: reason ?? "" });
  return data;
}

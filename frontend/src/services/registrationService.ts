import api from "./api";
import type { ApiMessage, RegistrationItem } from "../types";

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
}

export async function registerForEvent(eventId: string, payload?: RegistrationPayload) {
  const { data } = await api.post<RegisterResponse>(`/registrations/${eventId}`, payload ?? {});
  return data;
}

export async function cancelRegistration(eventId: string) {
  const { data } = await api.delete<ApiMessage>(`/registrations/${eventId}`);
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

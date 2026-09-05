import api from './api';
import type { RegistrationItem, TeamItem } from '../types';

export interface RegistrationPayload {
  name: string;
  collegeId: string;
  collegeName: string;
  department: string;
}

export interface RegisterResponse {
  msg: string;
  status: 'confirmed' | 'waitlisted';
  waitlistPosition?: number | null;
  registrationId?: string;
  attendanceQr?: string;
  registrationCode?: string;
  requested?: boolean;
}

export async function registerForEvent(eventId: string, payload?: RegistrationPayload) {
  const { data } = await api.post<RegisterResponse>(`/registrations/${eventId}`, payload ?? {});
  return data;
}

export async function createTeam(eventId: string, payload: RegistrationPayload & { teamName: string }) {
  const { data } = await api.post<TeamItem>(`/teams/${eventId}`, payload);
  return data;
}

export async function joinTeam(eventId: string, teamCode: string) {
  const { data } = await api.post<TeamItem>(`/teams/${eventId}/join`, { teamCode });
  return data;
}

export async function getMyTeam(eventId: string) {
  const { data } = await api.get<TeamItem>(`/teams/${eventId}/mine`);
  return data;
}

export async function leaveTeam(eventId: string) {
  const { data } = await api.post<{ msg: string }>(`/teams/${eventId}/leave`);
  return data;
}

export async function cancelRegistration(eventId: string) {
  const { data } = await api.delete<{ msg: string; requested?: boolean }>(
    `/registrations/${eventId}`
  );
  return data;
}

export async function getMyRegistrations() {
  const { data } = await api.get<RegistrationItem[]>('/my-registrations');
  return data;
}

export async function getEventRegistrations(eventId: string) {
  const { data } = await api.get<RegistrationItem[]>(`/event/${eventId}/registrations`);
  return data;
}

export async function regenerateRegistrationQr(registrationId: string) {
  const { data } = await api.post<{
    success: boolean;
    attendanceQr?: string;
    registrationCode?: string;
  }>(`/registrations/${registrationId}/regenerate-qr`);
  return data;
}

// Admin: cancellation management
export async function getPendingCancellations() {
  const { data } = await api.get<RegistrationItem[]>('/cancellations/pending');
  return data;
}

export async function approveCancellation(registrationId: string) {
  const { data } = await api.put<{ msg: string }>(`/cancellations/${registrationId}/approve`);
  return data;
}

export async function rejectCancellation(registrationId: string, reason?: string) {
  const { data } = await api.put<{ msg: string }>(`/cancellations/${registrationId}/reject`, {
    reason: reason ?? '',
  });
  return data;
}

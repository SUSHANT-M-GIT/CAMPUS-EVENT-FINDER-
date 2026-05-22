import api from "./api";
import type { EventItem } from "../types";

export interface EventsQuery {
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export interface EventPayload {
  title: string;
  description: string;
  type: EventItem["type"];
  date: string;
  time: string;
  registrationDeadline: string;
  location: string;
  maxRegistrations: number;
  eligibility: "all" | "own_college";
  tags: string[];
  // Banner: either a local File or a Google Drive share link
  imageFile?: File | null;
  gdriveLink?: string;
}

export async function getEvents(query: EventsQuery = {}) {
  const { data } = await api.get<EventItem[]>("/events", { params: query });
  return data;
}

export async function getEventById(id: string) {
  const { data } = await api.get<EventItem>(`/events/${id}`);
  return data;
}

/** Build FormData so multer can parse the file on the backend */
function buildFormData(payload: EventPayload): FormData {
  const fd = new FormData();
  fd.append("title",                payload.title);
  fd.append("description",          payload.description);
  fd.append("type",                 payload.type);
  fd.append("date",                 payload.date);
  fd.append("time",                 payload.time);
  fd.append("registrationDeadline", payload.registrationDeadline);
  fd.append("location",             payload.location);
  fd.append("maxRegistrations",     String(payload.maxRegistrations));
  fd.append("eligibility",          payload.eligibility);
  payload.tags.forEach(t => fd.append("tags[]", t));
  if (payload.imageFile)  fd.append("image",      payload.imageFile);
  if (payload.gdriveLink) fd.append("gdriveLink", payload.gdriveLink);
  return fd;
}

export async function createEvent(payload: EventPayload) {
  const { data } = await api.post<EventItem>("/events", buildFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateEvent(id: string, payload: EventPayload) {
  const { data } = await api.put<EventItem>(`/events/${id}`, buildFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteEvent(id: string, reason?: string) {
  const { data } = await api.delete<{ msg: string }>(`/events/${id}`, { data: { reason: reason || "" } });
  return data;
}

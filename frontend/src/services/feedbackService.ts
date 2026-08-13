import api from './api';
import type { FeedbackItem } from '../types';

export interface FeedbackPayload {
  rating: number;
  comment: string;
}

export interface EventFeedbackResponse {
  avgRating: number;
  feedbackCount: number;
  feedbacks: FeedbackItem[];
}

export async function submitFeedback(eventId: string, payload: FeedbackPayload) {
  const { data } = await api.post<{ msg: string }>(`/feedback/${eventId}`, payload);
  return data;
}

export async function getMyFeedback(eventId: string) {
  const { data } = await api.get<FeedbackItem | null>(`/feedback/${eventId}/mine`);
  return data;
}

export async function getEventFeedback(eventId: string) {
  const { data } = await api.get<EventFeedbackResponse>(`/feedback/${eventId}`);
  return data;
}

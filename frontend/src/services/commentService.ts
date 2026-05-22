import api from "./api";
import type { CommentItem } from "../types";

export async function getComments(eventId: string) {
  const { data } = await api.get<CommentItem[]>(`/comments/${eventId}`);
  return data;
}

export async function addComment(eventId: string, text: string, parentId?: string) {
  const { data } = await api.post<CommentItem>(`/comments/${eventId}`, { text, parentId });
  return data;
}

export async function deleteComment(commentId: string) {
  const { data } = await api.delete<{ msg: string }>(`/comments/${commentId}`);
  return data;
}

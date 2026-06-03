import api from "./api";

export interface PaymentStatusResponse {
  paymentStatus: "free" | "pending" | "approved" | "rejected";
  transactionId?: string;
  paymentScreenshot?: string;
  paymentNote?: string;
}

export interface SubmitPaymentPayload {
  transactionId: string;
  screenshot: File;
}

/** Student: submit payment screenshot + transaction ID */
export async function submitPayment(registrationId: string, payload: SubmitPaymentPayload) {
  const form = new FormData();
  form.append("transactionId", payload.transactionId.trim());
  form.append("screenshot", payload.screenshot);
  const { data } = await api.post<{ msg: string }>(
    `/payment/submit/${registrationId}`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

/** Student: get own payment status for a specific event */
export async function getMyPaymentStatus(eventId: string) {
  const { data } = await api.get<PaymentStatusResponse>(`/payment/my-status/${eventId}`);
  return data;
}

/** Admin: fetch all pending payment registrations */
export async function getPendingPayments() {
  const { data } = await api.get<any[]>("/payment/pending");
  return data;
}

/** Admin: approve a payment */
export async function approvePayment(registrationId: string) {
  const { data } = await api.put<{ msg: string }>(`/payment/approve/${registrationId}`);
  return data;
}

/** Admin: reject a payment with optional reason */
export async function rejectPayment(registrationId: string, reason?: string) {
  const { data } = await api.put<{ msg: string }>(`/payment/reject/${registrationId}`, { reason: reason ?? "" });
  return data;
}

/** Student: request a refund for an approved paid registration */
export async function requestRefund(registrationId: string) {
  const { data } = await api.post<{ msg: string; refundAmount: number }>(`/payment/refund/${registrationId}`);
  return data;
}

/** Admin: get all pending refund requests */
export async function getPendingRefunds() {
  const { data } = await api.get<any[]>("/payment/refunds/pending");
  return data;
}

/** Admin: approve a refund */
export async function approveRefund(registrationId: string) {
  const { data } = await api.put<{ msg: string }>(`/payment/refund/${registrationId}/approve`);
  return data;
}

/** Admin: reject a refund with optional reason */
export async function rejectRefund(registrationId: string, reason?: string) {
  const { data } = await api.put<{ msg: string }>(`/payment/refund/${registrationId}/reject`, { reason: reason ?? "" });
  return data;
}

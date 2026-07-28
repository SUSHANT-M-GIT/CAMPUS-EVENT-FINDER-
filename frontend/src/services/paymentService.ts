import api from "./api";

export interface PaymentStatusResponse {
  paymentStatus: "free" | "pending" | "approved" | "rejected";
  transactionId?: string;
  paymentScreenshot?: string;
  paymentNote?: string;
}

export interface RazorpayOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  eventTitle: string;
  studentName: string;
  studentEmail: string;
}

// ── Razorpay online payment ──────────────────────────────────────────────────

export async function createRazorpayOrder(registrationId: string): Promise<RazorpayOrderResponse> {
  const { data } = await api.post<RazorpayOrderResponse>(`/payment/create-order/${registrationId}`);
  return data;
}

export async function verifyRazorpayPayment(
  registrationId: string,
  payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) {
  const { data } = await api.post<{ msg: string }>(`/payment/verify/${registrationId}`, payload);
  return data;
}

// ── Manual UPI fallback ──────────────────────────────────────────────────────

export async function submitPayment(
  registrationId: string,
  payload: { transactionId: string; screenshot: File }
) {
  const form = new FormData();
  form.append("transactionId", payload.transactionId.trim());
  form.append("screenshot", payload.screenshot);
  const { data } = await api.post<{ msg: string }>(`/payment/submit/${registrationId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Shared ───────────────────────────────────────────────────────────────────

export async function getMyPaymentStatus(eventId: string) {
  const { data } = await api.get<PaymentStatusResponse>(`/payment/my-status/${eventId}`);
  return data;
}

export async function getPendingPayments() {
  const { data } = await api.get<any[]>("/payment/pending");
  return data;
}

export async function approvePayment(registrationId: string) {
  const { data } = await api.put<{ msg: string }>(`/payment/approve/${registrationId}`);
  return data;
}

export async function rejectPayment(registrationId: string, reason?: string) {
  const { data } = await api.put<{ msg: string }>(`/payment/reject/${registrationId}`, { reason: reason ?? "" });
  return data;
}

export async function requestRefund(registrationId: string) {
  const { data } = await api.post<{ msg: string; refundAmount: number }>(`/payment/refund/${registrationId}`);
  return data;
}

export async function getPendingRefunds() {
  const { data } = await api.get<any[]>("/payment/refunds/pending");
  return data;
}

export async function approveRefund(registrationId: string) {
  const { data } = await api.put<{ msg: string }>(`/payment/refund/${registrationId}/approve`);
  return data;
}

export async function rejectRefund(registrationId: string, reason?: string) {
  const { data } = await api.put<{ msg: string }>(`/payment/refund/${registrationId}/reject`, { reason: reason ?? "" });
  return data;
}

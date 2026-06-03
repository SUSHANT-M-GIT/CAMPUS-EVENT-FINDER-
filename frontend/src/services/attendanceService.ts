import api from "./api";

export interface QrResponse {
  attendanceQr: string | null;
  attendanceStatus: "absent" | "present";
  certificateId: string | null;
}

export interface AttendanceRecord {
  _id: string;
  studentName: string;
  studentEmail: string;
  collegeName: string;
  attendanceStatus: "absent" | "present";
  certificateId: string | null;
}

/** Student: get own QR code + attendance status for a registration */
export async function getMyQr(registrationId: string) {
  const { data } = await api.get<QrResponse>(`/attendance/my-qr/${registrationId}`);
  return data;
}

/** Student: download certificate PDF — returns blob URL */
export function getCertificateUrl(registrationId: string): string {
  const token = localStorage.getItem("token") ?? "";
  // We call via anchor href directly (authenticated via token in URL is not ideal,
  // so we use the fetch approach in the component instead)
  return `/api/attendance/certificate/${registrationId}`;
}

/** Admin: scan QR and mark attendance */
export async function scanQr(registrationId: string, eventId: string) {
  const { data } = await api.post<{ msg: string; student: string; event: string }>("/attendance/scan", {
    registrationId,
    eventId,
  });
  return data;
}

/** Admin: get attendance list for an event */
export async function getAttendanceList(eventId: string) {
  const { data } = await api.get<AttendanceRecord[]>(`/attendance/${eventId}`);
  return data;
}

/** Admin: enable certificate generation for event */
export async function enableCertificates(eventId: string) {
  const { data } = await api.put<{ msg: string }>(`/attendance/${eventId}/enable-certificates`);
  return data;
}

/** Utility: download certificate as PDF blob */
export async function downloadCertificatePdf(registrationId: string): Promise<void> {
  const token = localStorage.getItem("token") ?? "";
  const response = await fetch(`http://127.0.0.1:5000/api/attendance/certificate/${registrationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ msg: "Certificate download failed" }));
    throw new Error(err.msg || "Certificate download failed");
  }
  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `certificate-${registrationId}.pdf`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
}

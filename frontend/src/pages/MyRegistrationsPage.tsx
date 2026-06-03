import { useEffect, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import PaymentModal from "../components/PaymentModal";
import { getMyRegistrations } from "../services/registrationService";
import { requestRefund } from "../services/paymentService";
import { downloadCertificatePdf } from "../services/attendanceService";
import type { EventItem, RegistrationItem } from "../types";

export default function MyRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");

  // Payment modal state
  interface PaymentTarget { registrationId: string; event: EventItem; }
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [successMsg, setSuccessMsg]       = useState("");
  const [refundLoading, setRefundLoading] = useState<string | null>(null);
  const [certLoading, setCertLoading]     = useState<string | null>(null);
  const [qrOpen, setQrOpen]               = useState<string | null>(null); // registrationId

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getMyRegistrations();
      setRegistrations(data);
    } catch {
      setError("Could not load registrations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRefund = async (regId: string) => {
    if (!window.confirm("Request a refund for this registration? This cannot be undone.")) return;
    setRefundLoading(regId);
    try {
      const res = await requestRefund(regId);
      setSuccessMsg(res.msg);
      await load();
    } catch (err: any) {
      setSuccessMsg(""); // clear any previous
      alert(err?.response?.data?.msg || "Refund request failed.");
    } finally {
      setRefundLoading(null);
    }
  };

  const handleDownloadCertificate = async (regId: string) => {
    setCertLoading(regId);
    try {
      await downloadCertificatePdf(regId);
    } catch (err: any) {
      alert(err?.message || "Certificate download failed.");
    } finally {
      setCertLoading(null);
    }
  };

  useEffect(() => { void load(); }, []);

  const now = new Date();

  /** Payment status badge — mirrors UserDashboardPage styling */
  const PaymentBadge = ({ status }: { status: RegistrationItem["paymentStatus"] }) => {
    if (!status || status === "free") {
      return (
        <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600 }}>
          🟢 Registration Confirmed
        </span>
      );
    }
    if (status === "approved") {
      return (
        <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600 }}>
          🟢 Payment Approved
        </span>
      );
    }
    if (status === "pending") {
      return (
        <span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600 }}>
          🟡 Payment Pending
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600 }}>
          🔴 Payment Rejected
        </span>
      );
    }
    return null;
  };

  const StatusBadge = ({ status }: { status?: string }) => {
    if (status === "waitlisted") {
      return (
        <span style={{ background: "#f3e8ff", color: "#7c3aed", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600 }}>
          ⏳ Waitlisted
        </span>
      );
    }
    return null;
  };

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ marginBottom: 24, fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>
        🎟️ My Registrations
      </h1>

      {successMsg && (
        <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#166534", fontWeight: 600 }}>
          ✅ {successMsg}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <p style={{ color: "#dc2626" }}>{error}</p>
      ) : registrations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎟️</div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "1rem" }}>No registrations yet</p>
          <p style={{ margin: "6px 0 0", fontSize: "0.85rem" }}>Browse events on your dashboard to register!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {registrations.map((reg) => {
            const event   = reg.eventId as EventItem;
            const isPast  = event?.date ? new Date(event.date) < now : false;

            return (
              <div
                key={reg._id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 2px 8px rgba(2,48,71,0.06)",
                  overflow: "hidden",
                }}
              >
                {/* Card header */}
                <div style={{
                  background: isPast ? "#f8fafc" : "#f0f7fb",
                  padding: "12px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid #e2e8f0",
                  flexWrap: "wrap",
                  gap: 8,
                }}>
                  <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                    {event?.title ?? "Event Removed"}
                  </h2>
                  <span style={{
                    background: isPast ? "#f1f5f9" : "#dcfce7",
                    color:      isPast ? "#475569"  : "#166534",
                    borderRadius: 99,
                    padding: "2px 10px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}>
                    {isPast ? "Past" : "Upcoming"}
                  </span>
                </div>

                {/* Card body */}
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Event meta */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.83rem", color: "#64748b" }}>
                    {event?.date && (
                      <span>📅 {new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                    )}
                    {event?.time && <span>⏰ {event.time}</span>}
                    {event?.location && <span>📍 {event.location}</span>}
                  </div>

                  {/* Registration meta */}
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                    Registered: {new Date(reg.registeredAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>

                  {/* Status badges row */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {/* Show waitlist or payment status */}
                    {reg.status === "waitlisted" ? (
                      <StatusBadge status={reg.status} />
                    ) : (
                      <PaymentBadge status={reg.paymentStatus} />
                    )}

                    {/* Event price badge */}
                    {event?.isPaid && (
                      <span style={{ background: "#f0fdf4", color: "#166534", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600, border: "1px solid #86efac" }}>
                        💰 ₹{event.price}
                      </span>
                    )}
                  </div>

                  {/* Transaction ID if available */}
                  {reg.transactionId && (
                    <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "8px 12px" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>Transaction ID: </span>
                      <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#0369a1", fontWeight: 700 }}>
                        {reg.transactionId}
                      </span>
                    </div>
                  )}

                  {/* Rejection reason if rejected */}
                  {reg.paymentStatus === "rejected" && reg.paymentNote && (
                    <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: "0.82rem", color: "#991b1b" }}>
                      <strong>Rejection reason:</strong> {reg.paymentNote}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {/* Pay Now — pending, no transaction yet */}
                    {reg.status !== "waitlisted" && reg.paymentStatus === "pending" && !reg.transactionId && event?._id && (
                      <button
                        type="button"
                        onClick={() => setPaymentTarget({ registrationId: reg._id, event })}
                        style={{ background: "#059669", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        💳 Pay Now
                      </button>
                    )}

                    {/* Pay Again — rejected, re-submit */}
                    {reg.paymentStatus === "rejected" && event?._id && (
                      <button
                        type="button"
                        onClick={() => setPaymentTarget({ registrationId: reg._id, event })}
                        style={{ background: "#4f46e5", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        💳 Pay Again
                      </button>
                    )}

                    {/* Show QR code (free confirmed or paid approved) */}
                    {reg.attendanceQr && reg.status === "confirmed" && reg.paymentStatus !== "pending" && reg.paymentStatus !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => setQrOpen(qrOpen === reg._id ? null : reg._id)}
                        style={{ background: "#0369a1", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        {qrOpen === reg._id ? "🔼 Hide QR" : "📱 Show QR"}
                      </button>
                    )}

                    {/* Request Refund */}
                    {reg.paymentStatus === "approved" && reg.refundStatus === "none" && event?.refundAllowed && (
                      <button
                        type="button"
                        onClick={() => void handleRequestRefund(reg._id)}
                        disabled={refundLoading === reg._id}
                        style={{ background: "#f59e0b", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        {refundLoading === reg._id ? "Requesting…" : "↩️ Request Refund"}
                      </button>
                    )}

                    {/* Refund status badges */}
                    {reg.refundStatus === "requested" && (
                      <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 8, padding: "8px 12px", fontSize: "0.78rem", fontWeight: 700 }}>
                        ⏳ Refund Pending
                      </span>
                    )}
                    {reg.refundStatus === "approved" && (
                      <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "8px 12px", fontSize: "0.78rem", fontWeight: 700 }}>
                        ✅ Refund Approved · ₹{reg.refundAmount}
                      </span>
                    )}
                    {reg.refundStatus === "rejected" && (
                      <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 8, padding: "8px 12px", fontSize: "0.78rem", fontWeight: 700 }}>
                        ❌ Refund Rejected
                      </span>
                    )}

                    {/* Download Certificate */}
                    {reg.attendanceStatus === "present" && event?.certificatesEnabled && (
                      <button
                        type="button"
                        onClick={() => void handleDownloadCertificate(reg._id)}
                        disabled={certLoading === reg._id}
                        style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", border: 0, borderRadius: 8, padding: "8px 14px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                      >
                        {certLoading === reg._id ? "Generating…" : "🏆 Download Certificate"}
                      </button>
                    )}

                    {/* Attendance badge */}
                    {reg.attendanceStatus === "present" && (
                      <span style={{ background: "#dcfce7", color: "#166534", borderRadius: 8, padding: "8px 12px", fontSize: "0.78rem", fontWeight: 700 }}>
                        ✅ Attended
                      </span>
                    )}
                  </div>

                  {/* QR Code Display */}
                  {qrOpen === reg._id && reg.attendanceQr && (
                    <div style={{ marginTop: 12, textAlign: "center", background: "#f8fafc", borderRadius: 10, padding: "16px", border: "1px solid #e2e8f0" }}>
                      <p style={{ margin: "0 0 8px", fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>Your Attendance QR Code</p>
                      <img src={reg.attendanceQr} alt="Attendance QR" style={{ width: 180, height: 180, border: "1px solid #e2e8f0", borderRadius: 8 }} />
                      <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Show this to the event organizer at the venue</p>
                      <a
                        href={reg.attendanceQr}
                        download={`qr-${reg._id}.png`}
                        style={{ display: "inline-block", marginTop: 8, background: "#4f46e5", color: "#fff", borderRadius: 7, padding: "6px 14px", fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}
                      >
                        ⬇️ Download QR
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── PAYMENT MODAL ── */}
      {paymentTarget && (
        <PaymentModal
          registrationId={paymentTarget.registrationId}
          eventTitle={paymentTarget.event.title}
          price={paymentTarget.event.price ?? 0}
          upiId={paymentTarget.event.upiId}
          qrImage={paymentTarget.event.qrImage}
          onClose={() => setPaymentTarget(null)}
          onSuccess={() => {
            setPaymentTarget(null);
            setSuccessMsg("Payment submitted! Awaiting admin verification.");
            void load();
          }}
        />
      )}
    </main>
  );
}

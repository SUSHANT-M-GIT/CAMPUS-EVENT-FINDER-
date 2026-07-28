import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, IndianRupee, ShieldAlert, CreditCard, QrCode, Award, CheckCircle, Hourglass, AlertCircle, BookOpen, Download } from "lucide-react";

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

  /** Payment status badge  mirrors UserDashboardPage styling */
  const PaymentBadge = ({ status }: { status: RegistrationItem["paymentStatus"] }) => {
    if (!status || status === "free") {
      return (
        <span style={{ background: "rgba(34,197,94,0.15)", color: "var(--success)", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CheckCircle size={12} /> Registration Confirmed
        </span>
      );
    }
    if (status === "approved") {
      return (
        <span style={{ background: "rgba(34,197,94,0.15)", color: "var(--success)", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CheckCircle size={12} /> Payment Approved
        </span>
      );
    }
    if (status === "pending") {
      return (
        <span style={{ background: "rgba(245,158,11,0.15)", color: "#92400e", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Hourglass size={12} /> Payment Pending
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span style={{ background: "rgba(239,68,68,0.15)", color: "var(--danger)", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={12} /> Payment Rejected
        </span>
      );
    }
    return null;
  };

  const StatusBadge = ({ status }: { status?: string }) => {
    if (status === "waitlisted") {
      return (
        <span style={{ background: "rgba(168,85,247,0.15)", color: "#7c3aed", borderRadius: 8, padding: "4px 10px", fontSize: "0.78rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Clock size={12} /> Waitlisted
        </span>
      );
    }
    return null;
  };

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ marginBottom: 24, fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>
        <BookOpen size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />My Registrations
      </h1>

      {successMsg && (
        <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "var(--success)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <p style={{ color: "#dc2626" }}>{error}</p>
      ) : registrations.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎫</div>
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
                  background: "var(--surface-2)",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  boxShadow: "0 2px 8px rgba(2,48,71,0.06)",
                  overflow: "hidden",
                }}
              >
                {/* Card header */}
                <div style={{
                  background: isPast ? "rgba(148, 163, 184, 0.08)" : "rgba(108, 99, 255, 0.08)",
                  padding: "12px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid var(--border)",
                  flexWrap: "wrap",
                  gap: 8,
                }}>
                  <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
                    {event?.title ?? "Event Removed"}
                  </h2>
                  <span className={isPast ? "badge badge-muted" : "badge badge-primary"}>
                    {isPast ? "Past" : "Upcoming"}
                  </span>
                </div>

                {/* Card body */}
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Event meta */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: "0.83rem", color: "var(--text-muted)", alignItems: "center" }}>
                    {event?.date && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Calendar size={14} />
                        {new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                    {event?.time && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={14} />
                        {event.time}
                      </span>
                    )}
                    {event?.location && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={14} />
                        {event.location}
                      </span>
                    )}
                  </div>

                  {/* Registration meta */}
                  <div style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
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
                      <span className="badge badge-success">
                        <IndianRupee size={11} /> {event.price}
                      </span>
                    )}
                  </div>

                  {/* Transaction ID if available */}
                  {reg.transactionId && (
                    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Transaction ID: </span>
                      <span style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--primary)", fontWeight: 700 }}>
                        {reg.transactionId}
                      </span>
                    </div>
                  )}

                  {/* Rejection reason if rejected */}
                  {reg.paymentStatus === "rejected" && reg.paymentNote && (
                    <div className="alert alert-error" style={{ padding: "8px 12px", margin: 0, fontSize: "0.82rem" }}>
                      <ShieldAlert size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div><strong>Rejection reason:</strong> {reg.paymentNote}</div>
                    </div>
                  )}

                  {/* Registration Code — always visible, used for manual attendance */}
                  {reg.registrationCode && reg.status === "confirmed" && reg.paymentStatus !== "pending" && reg.paymentStatus !== "rejected" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(79,70,229,0.1)", border: "1px solid rgba(79,70,229,0.25)", borderRadius: 10, padding: "10px 14px", flexWrap: "wrap" }}>
                      <QrCode size={16} color="#818cf8" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your Registration Code</p>
                        <span style={{ fontFamily: "monospace", fontSize: "1.05rem", fontWeight: 800, color: "#a5b4fc", letterSpacing: "0.1em" }}>
                          {reg.registrationCode}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-dim)", textAlign: "right" }}>Show this to admin if QR scan fails</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {/* Pay Now  pending, no screenshot submitted yet */}
                    {reg.status !== "waitlisted" && reg.paymentStatus === "pending" && !reg.transactionId && event?._id && (
                      <button type="button" onClick={() => setPaymentTarget({ registrationId: reg._id, event })}
                        className="btn btn-primary btn-sm">
                        <CreditCard size={14} /> Pay Now
                      </button>
                    )}

                    {/* Pay Again  rejected, re-submit */}
                    {reg.paymentStatus === "rejected" && event?._id && (
                      <button
                        type="button"
                        onClick={() => setPaymentTarget({ registrationId: reg._id, event })}
                        className="btn btn-primary btn-sm"
                      >
                        <CreditCard size={14} /> Pay Again
                      </button>
                    )}

                    {/* Show QR code (free confirmed or paid approved) */}
                    {reg.attendanceQr && reg.status === "confirmed" && reg.paymentStatus !== "pending" && reg.paymentStatus !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => setQrOpen(qrOpen === reg._id ? null : reg._id)}
                        className="btn btn-secondary btn-sm"
                      >
                        <QrCode size={14} /> {qrOpen === reg._id ? "Hide QR" : "Show QR"}
                      </button>
                    )}

                    {/* Request Refund */}
                    {reg.paymentStatus === "approved" && reg.refundStatus === "none" && event?.refundAllowed && (
                      <button
                        type="button"
                        onClick={() => void handleRequestRefund(reg._id)}
                        disabled={refundLoading === reg._id}
                        className="btn btn-warning btn-sm"
                      >
                        {refundLoading === reg._id ? "Requesting" : "Request Refund"}
                      </button>
                    )}

                    {/* Refund status badges */}
                    {reg.refundStatus === "requested" && (
                      <span className="badge badge-warning">
                        <Hourglass size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />Refund Pending
                      </span>
                    )}
                    {reg.refundStatus === "approved" && (
                      <span className="badge badge-success">
                        <CheckCircle size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />Refund Approved · ₹{reg.refundAmount}
                      </span>
                    )}
                    {reg.refundStatus === "rejected" && (
                      <span className="badge badge-danger">
                        <AlertCircle size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />Refund Rejected
                      </span>
                    )}

                    {/* Download Certificate */}
                    {reg.attendanceStatus === "present" && event?.certificatesEnabled && (
                      <button
                        type="button"
                        onClick={() => void handleDownloadCertificate(reg._id)}
                        disabled={certLoading === reg._id}
                        className="btn btn-primary btn-sm"
                      >
                        <Award size={14} /> {certLoading === reg._id ? "Generating" : "Download Certificate"}
                      </button>
                    )}

                    {/* Attendance badge */}
                    {reg.attendanceStatus === "present" && (
                      <span className="badge badge-success">
                        <CheckCircle size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />Attended
                      </span>
                    )}
                  </div>

                  {/* QR Code Display */}
                  {qrOpen === reg._id && reg.attendanceQr && (
                    <div style={{ marginTop: 12, textAlign: "center", background: "var(--surface-2)", borderRadius: 10, padding: "20px 16px", border: "1px solid var(--border)" }}>
                      <p style={{ margin: "0 0 12px", fontSize: "0.85rem", fontWeight: 700, color: "var(--text-2)" }}>📱 Attendance QR Code</p>
                      <img src={reg.attendanceQr} alt="Attendance QR" style={{ width: 200, height: 200, border: "2px solid var(--border)", borderRadius: 12, background: "#fff", padding: 6 }} />
                      <p style={{ margin: "12px 0 4px", fontSize: "0.78rem", color: "var(--text-dim)" }}>
                        Show this to the organizer at the venue — or give your code above if scanning fails.
                      </p>
                      <a
                        href={reg.attendanceQr}
                        download={`qr-${reg.registrationCode || reg._id}.png`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", borderRadius: 8, padding: "8px 18px", fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}
                      >
                        <Download size={13} /> Download QR
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/*  PAYMENT MODAL  */}
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
            setSuccessMsg("Payment submitted! Admin will verify and confirm your registration shortly.");
            void load();
          }}
        />
      )}
    </main>
  );
}


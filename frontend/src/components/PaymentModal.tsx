/**
 * PaymentModal.tsx
 * Shown when a student registers for a paid event.
 * Displays QR code, UPI ID, amount, and lets the student upload a screenshot + transaction ID.
 */
import { useRef, useState } from "react";
import { submitPayment } from "../services/paymentService";
import api from "../services/api";

// Derive backend base URL from the api axios instance so it works in all environments
const API_BASE = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

interface Props {
  registrationId: string;
  eventTitle: string;
  price: number;
  upiId?: string;
  qrImage?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({ registrationId, eventTitle, price, upiId, qrImage, onClose, onSuccess }: Props) {
  const [transactionId, setTransactionId] = useState("");
  const [screenshot, setScreenshot]       = useState<File | null>(null);
  const [preview, setPreview]             = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [success, setSuccess]             = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setScreenshot(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!transactionId.trim()) { setError("Please enter your Transaction ID."); return; }
    if (!screenshot)           { setError("Please upload your payment screenshot."); return; }
    setLoading(true);
    try {
      await submitPayment(registrationId, { transactionId, screenshot });
      setSuccess("Payment submitted! Awaiting admin verification.");
      setTimeout(() => { onSuccess(); onClose(); }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.msg || "Payment submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Build QR image URL correctly — use API_BASE for server-stored paths
  const qrSrc = qrImage
    ? (qrImage.startsWith("/") ? `${API_BASE}${qrImage}` : qrImage)
    : null;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(2,48,71,0.6)", display: "grid", placeItems: "center", padding: 16, zIndex: 100, backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(520px,100%)", background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#023047,#2B2D42)", padding: "20px 24px", color: "#fff" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>💳 Complete Payment</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", opacity: 0.8 }}>{eventTitle}</p>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Amount */}
          <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "#166534" }}>Amount to Pay</span>
            <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "#059669" }}>₹{price}</span>
          </div>

          {/* QR + UPI */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            {qrSrc && (
              <div style={{ flex: "0 0 auto" }}>
                <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>Scan QR Code</p>
                <img
                  src={qrSrc}
                  alt="Payment QR"
                  style={{ width: 140, height: 140, objectFit: "contain", border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", padding: 6 }}
                />
              </div>
            )}
            {upiId && (
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>UPI ID</p>
                <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontFamily: "monospace", fontSize: "0.95rem", color: "#1e293b", fontWeight: 700, wordBreak: "break-all" }}>
                  {upiId}
                </div>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(upiId).catch(() => {}); }}
                  style={{ marginTop: 6, background: "none", border: "1px solid #c7d2fe", borderRadius: 7, padding: "4px 10px", fontSize: "0.75rem", cursor: "pointer", color: "#4f46e5", fontWeight: 600 }}
                >
                  📋 Copy UPI ID
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div style={{ background: "#fef3c7", borderRadius: 9, padding: "10px 14px", marginBottom: 18, fontSize: "0.82rem", color: "#92400e", lineHeight: 1.5 }}>
            <strong>Steps:</strong> Pay via UPI app using the QR or UPI ID above → Take a screenshot → Enter Transaction ID below → Submit
          </div>

          {/* Form */}
          {success ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>✅</div>
              <p style={{ margin: 0, fontWeight: 700, color: "#059669", fontSize: "1rem" }}>{success}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
              {error && (
                <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: "0.84rem", color: "#991b1b" }}>
                  ⚠ {error}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  Transaction ID <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  placeholder="e.g. UPI/123456789"
                  style={{ width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 12px", fontSize: "0.9rem", outline: "none", fontFamily: "monospace" }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  Payment Screenshot <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{ width: "100%", background: "#f8fafc", border: "2px dashed #c7d2fe", borderRadius: 9, padding: "12px", cursor: "pointer", fontSize: "0.88rem", color: "#4f46e5", fontWeight: 600, textAlign: "center" }}
                >
                  {screenshot ? `✓ ${screenshot.name}` : "📎 Click to upload screenshot"}
                </button>
                {preview && (
                  <img src={preview} alt="Preview" style={{ marginTop: 8, width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ flex: 1, background: loading ? "#94a3b8" : "linear-gradient(135deg,#059669,#10b981)", color: "#fff", border: 0, borderRadius: 10, padding: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: "0.95rem" }}
                >
                  {loading ? "Submitting…" : "Submit Payment"}
                </button>
                <button type="button" onClick={onClose} style={{ background: "#f1f5f9", color: "#475569", border: 0, borderRadius: 10, padding: "13px 18px", fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

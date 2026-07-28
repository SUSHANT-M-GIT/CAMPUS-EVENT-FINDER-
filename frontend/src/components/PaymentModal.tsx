/**
 * PaymentModal.tsx
 * Manual UPI payment  shows event QR code + UPI ID,
 * student scans & pays, then uploads screenshot + transaction ID.
 * Admin verifies and approves/rejects from the Payments tab.
 */
import { useRef, useState } from "react";
import { submitPayment } from "../services/paymentService";
import api from "../services/api";

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
  const [copied, setCopied]               = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const qrSrc = qrImage ? (qrImage.startsWith("/") ? `${API_BASE}${qrImage}` : qrImage) : null;

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

  const handleCopyUpi = () => {
    if (!upiId) return;
    navigator.clipboard.writeText(upiId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!transactionId.trim()) { setError("Please enter your Transaction ID / UTR number."); return; }
    if (!screenshot)           { setError("Please upload your payment screenshot."); return; }
    setLoading(true);
    try {
      await submitPayment(registrationId, { transactionId, screenshot });
      setSuccess("Payment submitted! Admin will verify and confirm your registration shortly.");
      setTimeout(() => { onSuccess(); onClose(); }, 2500);
    } catch (err: any) {
      setError(err.response?.data?.msg || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(2,48,71,0.65)", display: "grid", placeItems: "center", padding: 16, zIndex: 100, backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(520px,100%)", background: "var(--surface-2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.28)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#023047,#1e3a5f)", padding: "20px 24px", color: "#fff", position: "sticky", top: 0, zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>💳 Complete Payment</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", opacity: 0.8 }}>{eventTitle}</p>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* Payment Stepper  always visible when not yet submitted */}
          {!success && (
            <div className="stepper">
              {[
                { label: "Scan QR", num: "1" },
                { label: "Pay",     num: "2" },
                { label: "Upload",  num: "3" },
                { label: "Verify",  num: "4" },
                { label: "Done",    num: "5" },
              ].map((s, i, arr) => (
                <div key={s.num} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? "auto" : "none" }}>
                  <div className="stepper-step">
                    <div className={`stepper-dot${i < 2 ? " done" : i === 2 ? " active" : ""}`}>{i < 2 ? "✓" : s.num}</div>
                    <div className={`stepper-label${i === 2 ? " active" : ""}`}>{s.label}</div>
                  </div>
                  {i < arr.length - 1 && <div className={`stepper-connector${i < 2 ? " done" : ""}`} />}
                </div>
              ))}
            </div>
          )}

          {/* Amount */}
          <div style={{ background: "rgba(34,197,94,0.1)", border: "1.5px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--success)" }}>Amount to Pay</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669" }}>Rs.{price}</span>
          </div>

          {/* QR + UPI — always show default QR if event has no custom one */}
          <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* QR Code */}
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <p style={{ margin: "0 0 8px", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Scan to Pay</p>
              <div style={{ position: "relative", display: "inline-block" }}>
                <img
                  src={qrSrc || "/qr-payment.png"}
                  alt="UPI Payment QR — FIT_BOY SUSHANT"
                  style={{ width: 180, height: 180, objectFit: "contain", borderRadius: 12, background: "#fff", padding: 8, border: "2px solid var(--border)", display: "block" }}
                  onError={e => { (e.target as HTMLImageElement).src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=mishrasushant029@oksbi&pn=SUSHANT+MISHRA&am=" + price; }}
                />
                <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--text-dim)", fontWeight: 500 }}>Scan with any UPI app</p>
              </div>
            </div>

            {/* UPI ID + instructions */}
            <div style={{ flex: 1, minWidth: 160 }}>
              {upiId && (
                <>
                  <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>UPI ID</p>
                  <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontFamily: "monospace", fontSize: "0.9rem", color: "var(--text)", fontWeight: 700, wordBreak: "break-all", marginBottom: 8 }}>
                    {upiId}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    style={{ background: copied ? "rgba(34,197,94,0.15)" : "transparent", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 7, padding: "5px 12px", fontSize: "0.75rem", cursor: "pointer", color: copied ? "var(--success)" : "var(--primary)", fontWeight: 600, transition: "all 0.2s", marginBottom: 12 }}
                  >
                    {copied ? "Copied!" : "Copy UPI ID"}
                  </button>
                </>
              )}
              {!upiId && (
                <>
                  <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>UPI ID</p>
                  <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "10px 12px", fontFamily: "monospace", fontSize: "0.9rem", color: "var(--text)", fontWeight: 700, marginBottom: 8 }}>
                    mishrasushant029@oksbi
                  </div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText("mishrasushant029@oksbi").catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    style={{ background: copied ? "rgba(34,197,94,0.15)" : "transparent", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 7, padding: "5px 12px", fontSize: "0.75rem", cursor: "pointer", color: copied ? "var(--success)" : "var(--primary)", fontWeight: 600, transition: "all 0.2s", marginBottom: 12 }}
                  >
                    {copied ? "Copied!" : "Copy UPI ID"}
                  </button>
                </>
              )}
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-2)" }}>How to pay:</p>
                <p style={{ margin: 0 }}>1. Open GPay / PhonePe / Paytm</p>
                <p style={{ margin: 0 }}>2. Scan QR or enter UPI ID</p>
                <p style={{ margin: 0 }}>3. Pay <strong style={{ color: "var(--success)" }}>Rs.{price}</strong> &amp; take screenshot</p>
                <p style={{ margin: 0 }}>4. Upload below to confirm</p>
              </div>
            </div>
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
                <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: "0.84rem", color: "var(--danger)" }}>
                  ⚠ {error}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>
                  Transaction ID / UTR Number <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  placeholder="e.g. 425123456789"
                  style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", fontSize: "0.9rem", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
                  required
                />
                <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--text-dim)" }}>
                  Find this in your UPI app  Transaction history  UTR / Reference number
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>
                  Payment Screenshot <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{ width: "100%", background: screenshot ? "#f0fdf4" : "#f8fafc", border: `2px dashed ${screenshot ? "#86efac" : "#c7d2fe"}`, borderRadius: 9, padding: "12px", cursor: "pointer", fontSize: "0.88rem", color: screenshot ? "#166534" : "#4f46e5", fontWeight: 600, textAlign: "center" }}
                >
                  {screenshot ? `📎 ${screenshot.name}` : "Click to upload screenshot"}
                </button>
                {preview && (
                  <img src={preview} alt="Preview" style={{ marginTop: 8, width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ flex: 1, background: loading ? "#94a3b8" : "linear-gradient(135deg,#059669,#10b981)", color: "#fff", border: 0, borderRadius: 10, padding: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: "0.95rem" }}
                >
                  {loading ? "Submitting" : "Submit Payment"}
                </button>
                <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-2)", border: 0, borderRadius: 10, padding: "13px 18px", fontWeight: 600, cursor: "pointer" }}>
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


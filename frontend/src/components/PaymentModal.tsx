/**
 * PaymentModal.tsx
 * Primary: Razorpay checkout popup (instant, automatic confirmation)
 * Fallback: Manual UPI screenshot upload (admin verifies)
 */
import { useRef, useState } from "react";
import { createRazorpayOrder, verifyRazorpayPayment, submitPayment } from "../services/paymentService";
import api from "../services/api";

const API_BASE = (api.defaults.baseURL ?? "").replace(/\/api\/?$/, "");

// Razorpay is loaded via <script> in index.html
declare const Razorpay: any;

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
  const [tab, setTab]           = useState<"razorpay" | "manual">("razorpay");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  // Manual form state
  const [transactionId, setTransactionId] = useState("");
  const [screenshot, setScreenshot]       = useState<File | null>(null);
  const [preview, setPreview]             = useState<string | null>(null);
  const [copied, setCopied]               = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const qrSrc = qrImage ? (qrImage.startsWith("/") ? `${API_BASE}${qrImage}` : qrImage) : null;

  // ── RAZORPAY FLOW ───────────────────────────────────────────────────────────
  const handleRazorpayPay = async () => {
    setError("");
    setLoading(true);
    try {
      const order = await createRazorpayOrder(registrationId);

      const options = {
        key:          order.keyId,
        amount:       order.amount,
        currency:     order.currency,
        name:         "Campus Event Finder",
        description:  order.eventTitle,
        order_id:     order.orderId,
        prefill: {
          name:  order.studentName,
          email: order.studentEmail,
        },
        theme: { color: "#4f46e5" },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError("Payment cancelled. You can try again or use manual UPI below.");
          },
        },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verifyRazorpayPayment(registrationId, {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });
            setSuccess("Payment successful! You are now registered. Check your email for the QR code.");
            setTimeout(() => { onSuccess(); onClose(); }, 2500);
          } catch (err: any) {
            setError(err?.response?.data?.msg || "Payment verification failed. Contact support.");
          } finally {
            setLoading(false);
          }
        },
      };

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        setLoading(false);
        setError(`Payment failed: ${resp.error?.description || "Unknown error"}. Try manual UPI below.`);
      });
      setLoading(false);
      rzp.open();
    } catch (err: any) {
      setLoading(false);
      setError(err?.response?.data?.msg || "Could not initiate payment. Try manual UPI below.");
    }
  };

  // ── MANUAL FLOW ─────────────────────────────────────────────────────────────
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

  const handleManualSubmit = async (e: React.FormEvent) => {
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
      setError(err?.response?.data?.msg || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyUpi = (id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const effectiveUpi = upiId || "mishrasushant029@oksbi";

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(2,48,71,0.65)", display: "grid", placeItems: "center", padding: 16, zIndex: 100, backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(500px,100%)", background: "var(--surface-2)", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.28)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#023047,#1e3a5f)", padding: "20px 24px", color: "#fff" }}>
          <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Complete Payment</h3>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", opacity: 0.8 }}>{eventTitle}</p>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* Amount pill */}
          <div style={{ background: "rgba(34,197,94,0.1)", border: "1.5px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, color: "var(--success)" }}>Amount to Pay</span>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "#059669" }}>Rs.{price}</span>
          </div>

          {/* Success state */}
          {success ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: 10 }}>✅</div>
              <p style={{ margin: 0, fontWeight: 700, color: "#059669", fontSize: "1rem" }}>{success}</p>
            </div>
          ) : (
            <>
              {/* Tab switcher */}
              <div style={{ display: "flex", background: "var(--surface)", borderRadius: 10, padding: 4, marginBottom: 20, gap: 4 }}>
                <button
                  type="button"
                  onClick={() => { setTab("razorpay"); setError(""); }}
                  style={{ flex: 1, padding: "9px", border: 0, borderRadius: 8, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s",
                    background: tab === "razorpay" ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "transparent",
                    color: tab === "razorpay" ? "#fff" : "var(--text-muted)" }}
                >
                  Pay Online (Recommended)
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("manual"); setError(""); }}
                  style={{ flex: 1, padding: "9px", border: 0, borderRadius: 8, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s",
                    background: tab === "manual" ? "rgba(255,255,255,0.1)" : "transparent",
                    color: tab === "manual" ? "var(--text)" : "var(--text-muted)" }}
                >
                  Manual UPI
                </button>
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: "0.84rem", color: "var(--danger)", marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* ── RAZORPAY TAB ── */}
              {tab === "razorpay" && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ background: "rgba(79,70,229,0.07)", border: "1px solid rgba(79,70,229,0.2)", borderRadius: 14, padding: "24px 20px", marginBottom: 20 }}>
                    <div style={{ fontSize: "2.8rem", marginBottom: 12 }}>⚡</div>
                    <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--text)", fontSize: "1rem" }}>Instant Online Payment</p>
                    <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                      Pay securely via UPI, Cards, Net Banking or Wallets.<br/>
                      Registration confirmed automatically — no admin approval needed.
                    </p>
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      {["GPay", "PhonePe", "Paytm", "Cards", "Net Banking"].map(m => (
                        <span key={m} style={{ background: "rgba(79,70,229,0.12)", color: "#818cf8", borderRadius: 99, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 600 }}>{m}</span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRazorpayPay}
                    disabled={loading}
                    style={{ width: "100%", background: loading ? "#94a3b8" : "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", border: 0, borderRadius: 12, padding: "14px", fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", fontSize: "1rem", boxShadow: "0 8px 24px rgba(79,70,229,0.4)", marginBottom: 12 }}
                  >
                    {loading ? "Opening payment..." : `Pay Rs.${price} Securely`}
                  </button>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-dim)" }}>
                    Powered by Razorpay — 100% secure & encrypted
                  </p>
                  <button type="button" onClick={onClose} style={{ marginTop: 12, background: "none", border: 0, color: "var(--text-dim)", fontSize: "0.82rem", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              )}

              {/* ── MANUAL UPI TAB ── */}
              {tab === "manual" && (
                <div>
                  {/* QR + UPI */}
                  <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ textAlign: "center", flexShrink: 0 }}>
                      <p style={{ margin: "0 0 6px", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Scan to Pay</p>
                      <img
                        src={qrSrc || "/qr-payment.png"}
                        alt="UPI QR"
                        style={{ width: 150, height: 150, objectFit: "contain", borderRadius: 10, background: "#fff", padding: 6, border: "2px solid var(--border)" }}
                        onError={e => { (e.target as HTMLImageElement).src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${effectiveUpi}&am=${price}`; }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <p style={{ margin: "0 0 5px", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>UPI ID</p>
                      <div style={{ background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontFamily: "monospace", fontSize: "0.85rem", color: "var(--text)", fontWeight: 700, wordBreak: "break-all", marginBottom: 6 }}>
                        {effectiveUpi}
                      </div>
                      <button type="button" onClick={() => copyUpi(effectiveUpi)}
                        style={{ background: copied ? "rgba(34,197,94,0.15)" : "transparent", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 7, padding: "4px 10px", fontSize: "0.72rem", cursor: "pointer", color: copied ? "var(--success)" : "var(--primary)", fontWeight: 600, marginBottom: 10 }}>
                        {copied ? "Copied!" : "Copy UPI ID"}
                      </button>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.65 }}>
                        <p style={{ margin: "0 0 2px", fontWeight: 600, color: "var(--text-2)" }}>Steps:</p>
                        <p style={{ margin: 0 }}>1. Open any UPI app</p>
                        <p style={{ margin: 0 }}>2. Pay <strong style={{ color: "var(--success)" }}>Rs.{price}</strong></p>
                        <p style={{ margin: 0 }}>3. Upload screenshot below</p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleManualSubmit} style={{ display: "grid", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>
                        Transaction ID / UTR <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        value={transactionId}
                        onChange={e => setTransactionId(e.target.value)}
                        placeholder="e.g. 425123456789"
                        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", fontSize: "0.88rem", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 5 }}>
                        Payment Screenshot <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                      <button type="button" onClick={() => fileRef.current?.click()}
                        style={{ width: "100%", background: screenshot ? "#f0fdf4" : "var(--surface)", border: `2px dashed ${screenshot ? "#86efac" : "rgba(99,102,241,0.4)"}`, borderRadius: 9, padding: "11px", cursor: "pointer", fontSize: "0.85rem", color: screenshot ? "#166534" : "var(--primary)", fontWeight: 600, textAlign: "center" }}>
                        {screenshot ? `Attached: ${screenshot.name}` : "Click to upload screenshot"}
                      </button>
                      {preview && <img src={preview} alt="Preview" style={{ marginTop: 8, width: "100%", maxHeight: 150, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="submit" disabled={loading}
                        style={{ flex: 1, background: loading ? "#94a3b8" : "linear-gradient(135deg,#059669,#10b981)", color: "#fff", border: 0, borderRadius: 10, padding: 12, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: "0.92rem" }}>
                        {loading ? "Submitting..." : "Submit for Verification"}
                      </button>
                      <button type="button" onClick={onClose}
                        style={{ background: "var(--surface)", color: "var(--text-2)", border: 0, borderRadius: 10, padding: "12px 16px", fontWeight: 600, cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-dim)", textAlign: "center" }}>
                      Admin will verify and confirm within a few hours
                    </p>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

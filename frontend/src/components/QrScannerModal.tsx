/**
 * QrScannerModal.tsx
 * Admin component for scanning QR codes and marking attendance.
 * Uses camera input (file/capture) — no external QR-scanner library needed.
 * Parses registrationId from the QR data URL via canvas/image decode.
 */
import { useRef, useState } from "react";
import jsQR from "jsqr";
import { scanQr, getAttendanceList, enableCertificates } from "../services/attendanceService";
import type { AttendanceRecord } from "../services/attendanceService";

interface Props {
  eventId: string;
  eventTitle: string;
  certificatesEnabled?: boolean;
  onClose: () => void;
}

export default function QrScannerModal({ eventId, eventTitle, certificatesEnabled, onClose }: Props) {
  const [scanResult, setScanResult]         = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);
  const [scanning, setScanning]             = useState(false);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [listLoading, setListLoading]       = useState(false);
  const [certLoading, setCertLoading]       = useState(false);
  const [manualId, setManualId]             = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadList = async () => {
    setListLoading(true);
    try {
      const data = await getAttendanceList(eventId);
      setAttendanceList(data);
    } catch { /* silent */ }
    finally { setListLoading(false); }
  };

  const processQrData = async (rawData: string) => {
    try {
      const parsed = JSON.parse(rawData);
      const registrationId = parsed.registrationId;
      if (!registrationId) throw new Error("Invalid QR data");
      const result = await scanQr(registrationId, eventId);
      setScanResult({ msg: result.msg, type: "success" });
      await loadList();
    } catch (err: any) {
      const msg = err?.response?.data?.msg || err?.message || "Scan failed";
      if (msg.includes("already marked") || msg.includes("alreadyScanned")) {
        setScanResult({ msg: "⚠ Attendance already marked for this student", type: "warn" });
      } else {
        setScanResult({ msg: `❌ ${msg}`, type: "error" });
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanResult(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width  = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (!code) {
        setScanResult({ msg: "❌ Could not decode QR code from image. Try a clearer photo.", type: "error" });
        return;
      }
      await processQrData(code.data);
    } catch (err: any) {
      setScanResult({ msg: `❌ ${err.message}`, type: "error" });
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleManualScan = async () => {
    if (!manualId.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await scanQr(manualId.trim(), eventId);
      setScanResult({ msg: result.msg, type: "success" });
      setManualId("");
      await loadList();
    } catch (err: any) {
      const msg = err?.response?.data?.msg || "Scan failed";
      setScanResult({ msg: msg.includes("already") ? `⚠ ${msg}` : `❌ ${msg}`, type: msg.includes("already") ? "warn" : "error" });
    } finally {
      setScanning(false); }
  };

  const handleEnableCerts = async () => {
    setCertLoading(true);
    try {
      const res = await enableCertificates(eventId);
      setScanResult({ msg: `✅ ${res.msg}`, type: "success" });
    } catch (err: any) {
      setScanResult({ msg: err?.response?.data?.msg || "Failed", type: "error" });
    } finally {
      setCertLoading(false);
    }
  };

  const present  = attendanceList.filter(r => r.attendanceStatus === "present").length;
  const total    = attendanceList.length;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,48,71,0.65)", display: "grid", placeItems: "center", zIndex: 200, backdropFilter: "blur(4px)", padding: 16 }}
      onClick={onClose}>
      <div style={{ width: "min(640px,100%)", background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#023047,#1e3a5f)", padding: "18px 24px", color: "#fff", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>📱 QR Attendance Scanner</h3>
              <p style={{ margin: "3px 0 0", fontSize: "0.82rem", opacity: 0.75 }}>{eventTitle}</p>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: 0, borderRadius: 8, padding: "6px 12px", color: "#fff", cursor: "pointer", fontSize: "0.85rem" }}>✕ Close</button>
          </div>
        </div>

        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {/* Scan result alert */}
          {scanResult && (
            <div style={{
              background: scanResult.type === "success" ? "#dcfce7" : scanResult.type === "warn" ? "#fef3c7" : "#fee2e2",
              color:      scanResult.type === "success" ? "#166534" : scanResult.type === "warn" ? "#92400e" : "#991b1b",
              borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontWeight: 600, fontSize: "0.9rem",
            }}>
              {scanResult.msg}
            </div>
          )}

          {/* Stats */}
          {attendanceList.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Total", value: total, color: "#4f46e5", bg: "#eef2ff" },
                { label: "Present", value: present, color: "#059669", bg: "#dcfce7" },
                { label: "Absent", value: total - present, color: "#dc2626", bg: "#fee2e2" },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Scan options */}
          <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>Upload QR Code Image</p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: "none" }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={scanning}
                style={{ width: "100%", background: scanning ? "#94a3b8" : "linear-gradient(135deg,#4f46e5,#6366f1)", color: "#fff", border: 0, borderRadius: 10, padding: "12px", fontWeight: 700, cursor: scanning ? "not-allowed" : "pointer", fontSize: "0.9rem" }}
              >
                {scanning ? "Processing…" : "📷 Open Camera / Upload QR Image"}
              </button>
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
              <p style={{ margin: "0 0 8px", fontSize: "0.82rem", fontWeight: 600, color: "#374151" }}>Manual Registration ID</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") void handleManualScan(); }}
                  placeholder="Paste Registration ID…"
                  style={{ flex: 1, border: "1.5px solid #d1d5db", borderRadius: 9, padding: "9px 12px", fontSize: "0.88rem", outline: "none" }}
                />
                <button
                  type="button"
                  onClick={handleManualScan}
                  disabled={!manualId.trim() || scanning}
                  style={{ background: "#059669", color: "#fff", border: 0, borderRadius: 9, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}
                >
                  Mark
                </button>
              </div>
            </div>
          </div>

          {/* Load attendance list */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              onClick={loadList}
              disabled={listLoading}
              style={{ flex: 1, background: "#f1f5f9", color: "#374151", border: 0, borderRadius: 9, padding: "9px", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
            >
              {listLoading ? "Loading…" : "🔄 Refresh Attendance List"}
            </button>
            {!certificatesEnabled && (
              <button
                type="button"
                onClick={handleEnableCerts}
                disabled={certLoading}
                style={{ flex: 1, background: "#7c3aed", color: "#fff", border: 0, borderRadius: 9, padding: "9px", fontWeight: 600, cursor: "pointer", fontSize: "0.85rem" }}
              >
                {certLoading ? "Enabling…" : "🏆 Enable Certificates"}
              </button>
            )}
            {certificatesEnabled && (
              <div style={{ flex: 1, background: "#dcfce7", color: "#166534", borderRadius: 9, padding: "9px", fontWeight: 600, fontSize: "0.85rem", textAlign: "center" }}>
                ✅ Certificates Active
              </div>
            )}
          </div>

          {/* Attendance list */}
          {attendanceList.length > 0 && (
            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                    {["Student", "College", "Status"].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", color: "#374151", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceList.map((r, i) => (
                    <tr key={r._id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafcff" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 600, color: "#1e293b" }}>{r.studentName}</td>
                      <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.collegeName || "—"}</td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={{
                          background: r.attendanceStatus === "present" ? "#dcfce7" : "#fee2e2",
                          color:      r.attendanceStatus === "present" ? "#166534" : "#991b1b",
                          borderRadius: 99, padding: "2px 8px", fontSize: "0.72rem", fontWeight: 700,
                        }}>
                          {r.attendanceStatus === "present" ? "✅ Present" : "❌ Absent"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

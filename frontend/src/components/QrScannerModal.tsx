/**
 * QrScannerModal.tsx
 * Admin component for scanning QR codes and marking attendance.
 * - Live camera scan via getUserMedia + jsQR frame loop
 * - File upload fallback
 * - Manual registration code entry
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';
import { scanQr, getAttendanceList, enableCertificates } from '../services/attendanceService';
import { extractErrorMessage } from '../utils/error';
import type { AttendanceRecord } from '../services/attendanceService';

interface Props {
  eventId: string;
  eventTitle: string;
  certificatesEnabled?: boolean;
  onClose: () => void;
}

export default function QrScannerModal({
  eventId,
  eventTitle,
  certificatesEnabled: certEnabledProp,
  onClose,
}: Props) {
  const [scanResult, setScanResult] = useState<{
    msg: string;
    type: 'success' | 'error' | 'warn';
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [manualId, setManualId] = useState('');
  // Local state so it updates after enabling without needing to re-open modal
  const [certificatesEnabled, setCertificatesEnabled] = useState(certEnabledProp ?? false);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const processedRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    processedRef.current = false;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await getAttendanceList(eventId);
      setAttendanceList(data);
    } catch {
      /* silent */
    } finally {
      setListLoading(false);
    }
  }, [eventId]);

  const processQrData = useCallback(
    async (rawData: string) => {
      try {
        // Support compact QR payloads (registrationCode|registrationId|eventId), legacy JSON payloads,
        // and raw strings (legacy/manual codes).
        let registrationId = rawData.trim();

        try {
          const parsed = JSON.parse(rawData);
          if (parsed && typeof parsed === 'object' && parsed.registrationId) {
            registrationId = String(parsed.registrationId).trim();
          }
        } catch {
          // ignore JSON parse failure - payload may be plain text
        }

        if (registrationId.includes('|')) {
          const parts = registrationId.split('|');
          if (parts.length >= 2) {
            registrationId = parts[1].trim();
          }
        }

        if (!registrationId) throw new Error('No registrationId in QR');

        const result = await scanQr(registrationId, eventId);
        setScanResult({ msg: result.msg, type: 'success' });
        await loadList();
      } catch (error: unknown) {
        const msg = extractErrorMessage(error, 'Scan failed');
        if (msg.includes('already marked') || msg.includes('alreadyScanned')) {
          setScanResult({ msg: 'Attendance already marked for this student', type: 'warn' });
        } else {
          setScanResult({ msg: 'Error: ' + msg, type: 'error' });
        }
      }
    },
    [eventId, loadList]
  );

  const scanFrame = useCallback(
    function scanFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code && !processedRef.current) {
        processedRef.current = true;
        stopCamera();
        setScanning(true);
        processQrData(code.data).finally(() => setScanning(false));
        return;
      }
      rafRef.current = requestAnimationFrame(scanFrame);
    },
    [stopCamera, processQrData]
  );

  const startCamera = async () => {
    setCameraError(null);
    setScanResult(null);
    processedRef.current = false;
    // Show the video element first so the ref is mounted
    setCameraActive(true);
    // Wait one frame for React to render the <video> element
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Video element not ready');
      video.srcObject = stream;
      // Wait for metadata so dimensions are available
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Video load error'));
        setTimeout(() => resolve(), 3000); // fallback
      });
      await video.play();
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (error: unknown) {
      setCameraActive(false);
      const err = error as { name?: string; message?: string };
      let msg = 'Camera error: ' + extractErrorMessage(error, 'unknown');
      if (err.name === 'NotAllowedError') {
        msg =
          'Camera permission denied. Please allow camera access in your browser settings and try again.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera found on this device.';
      }
      setCameraError(msg);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanResult(null);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, canvas.width, canvas.height);
      if (!code) {
        setScanResult({
          msg: 'Could not decode QR from image. Try a clearer photo.',
          type: 'error',
        });
        return;
      }
      await processQrData(code.data);
    } catch (error: unknown) {
      const msg = extractErrorMessage(error, 'Error');
      setScanResult({ msg: 'Error: ' + msg, type: 'error' });
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleManualScan = async () => {
    if (!manualId.trim()) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await scanQr(manualId.trim(), eventId);
      setScanResult({ msg: result.msg, type: 'success' });
      setManualId('');
      await loadList();
    } catch (error: unknown) {
      const typedError = error as { response?: { data?: { msg?: string } } };
      const msg = typedError.response?.data?.msg || extractErrorMessage(error, 'Scan failed');
      setScanResult({ msg, type: msg.includes('already') ? 'warn' : 'error' });
    } finally {
      setScanning(false);
    }
  };

  const handleEnableCerts = async () => {
    setCertLoading(true);
    try {
      const res = await enableCertificates(eventId);
      setCertificatesEnabled(true);
      setScanResult({ msg: res.msg, type: 'success' });
    } catch (error: unknown) {
      const msg = extractErrorMessage(error, 'Failed');
      setScanResult({ msg, type: 'error' });
    } finally {
      setCertLoading(false);
    }
  };

  const present = attendanceList.filter((r) => r.attendanceStatus === 'present').length;
  const total = attendanceList.length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,48,71,0.65)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 200,
        backdropFilter: 'blur(4px)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(640px,100%)',
          background: 'var(--surface-2)',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg,#023047,#1e3a5f)',
            padding: '18px 24px',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                QR Attendance Scanner
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.82rem', opacity: 0.75 }}>{eventTitle}</p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 0,
                borderRadius: 8,
                padding: '6px 12px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              x Close
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Scan result */}
          {scanResult && (
            <div
              style={{
                background:
                  scanResult.type === 'success'
                    ? '#dcfce7'
                    : scanResult.type === 'warn'
                      ? '#fef3c7'
                      : '#fee2e2',
                color:
                  scanResult.type === 'success'
                    ? '#166534'
                    : scanResult.type === 'warn'
                      ? '#92400e'
                      : '#991b1b',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 16,
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              {scanResult.msg}
            </div>
          )}

          {/* Stats */}
          {attendanceList.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {[
                { label: 'Total', value: total, color: '#4f46e5', bg: '#eef2ff' },
                { label: 'Present', value: present, color: '#059669', bg: '#dcfce7' },
                { label: 'Absent', value: total - present, color: '#dc2626', bg: '#fee2e2' },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    flex: 1,
                    background: s.bg,
                    borderRadius: 10,
                    padding: '10px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Live Camera */}
          <div style={{ marginBottom: 16 }}>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-2)',
              }}
            >
              Live Camera Scan
            </p>

            {/* Video element always mounted so ref is always available */}
            <div
              style={{
                position: 'relative',
                borderRadius: 10,
                overflow: 'hidden',
                background: '#000',
                marginBottom: 10,
                display: cameraActive ? 'block' : 'none',
              }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', display: 'block', maxHeight: 260, objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    width: 180,
                    height: 180,
                    border: '3px solid rgba(99,102,241,0.9)',
                    borderRadius: 12,
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                  }}
                />
              </div>
              <div
                style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}
              >
                <span
                  style={{
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: 99,
                  }}
                >
                  Point camera at QR code
                </span>
              </div>
            </div>

            {cameraError && (
              <div
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: '0.84rem',
                  marginBottom: 8,
                }}
              >
                {cameraError}
              </div>
            )}

            {/* Hidden canvas for frame decoding — always mounted */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                disabled={scanning}
                style={{
                  width: '100%',
                  background: scanning ? '#94a3b8' : 'linear-gradient(135deg,#4f46e5,#6366f1)',
                  color: '#fff',
                  border: 0,
                  borderRadius: 10,
                  padding: '12px',
                  fontWeight: 700,
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {scanning ? 'Processing...' : 'Open Live Camera'}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                style={{
                  width: '100%',
                  background: '#dc2626',
                  color: '#fff',
                  border: 0,
                  borderRadius: 10,
                  padding: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                }}
              >
                Stop Camera
              </button>
            )}
          </div>

          {/* File Upload */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16 }}>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-2)',
              }}
            >
              Upload QR Image
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={scanning || cameraActive}
              style={{
                width: '100%',
                background: scanning || cameraActive ? '#94a3b8' : 'rgba(99,102,241,0.15)',
                color: scanning || cameraActive ? '#fff' : '#818cf8',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 10,
                padding: '10px',
                fontWeight: 700,
                cursor: scanning || cameraActive ? 'not-allowed' : 'pointer',
                fontSize: '0.88rem',
              }}
            >
              {scanning ? 'Processing...' : 'Select QR Image from Device'}
            </button>
          </div>

          {/* Manual Code */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 20 }}>
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-2)',
              }}
            >
              Manual Registration Code
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleManualScan();
                }}
                placeholder="Enter code e.g. REG-A1B2C3"
                style={{
                  flex: 1,
                  border: '1px solid var(--border)',
                  borderRadius: 9,
                  padding: '9px 12px',
                  fontSize: '0.88rem',
                  outline: 'none',
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                }}
              />
              <button
                type="button"
                onClick={handleManualScan}
                disabled={!manualId.trim() || scanning}
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 0,
                  borderRadius: 9,
                  padding: '9px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Mark
              </button>
            </div>
          </div>

          {/* Actions row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              onClick={loadList}
              disabled={listLoading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-2)',
                border: 0,
                borderRadius: 9,
                padding: '9px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              {listLoading ? 'Loading...' : 'Refresh Attendance List'}
            </button>
            {!certificatesEnabled && (
              <button
                type="button"
                onClick={handleEnableCerts}
                disabled={certLoading}
                style={{
                  flex: 1,
                  background: '#7c3aed',
                  color: '#fff',
                  border: 0,
                  borderRadius: 9,
                  padding: '9px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                {certLoading ? 'Enabling...' : 'Enable Certificates'}
              </button>
            )}
            {certificatesEnabled && (
              <div
                style={{
                  flex: 1,
                  background: 'rgba(34,197,94,0.15)',
                  color: 'var(--success)',
                  borderRadius: 9,
                  padding: '9px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  textAlign: 'center',
                }}
              >
                Certificates Active
              </div>
            )}
          </div>

          {/* Attendance list */}
          {attendanceList.length > 0 && (
            <div
              style={{
                maxHeight: 260,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 10,
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0 }}>
                    {['Student', 'College', 'Status'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '9px 12px',
                          textAlign: 'left',
                          color: 'var(--text-2)',
                          fontWeight: 600,
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceList.map((r, i) => (
                    <tr
                      key={r._id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)',
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text)' }}>
                        {r.studentName}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                        {r.collegeName || ''}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            background: r.attendanceStatus === 'present' ? '#dcfce7' : '#fee2e2',
                            color: r.attendanceStatus === 'present' ? '#166534' : '#991b1b',
                            borderRadius: 99,
                            padding: '2px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          {r.attendanceStatus === 'present' ? 'Present' : 'Absent'}
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

import { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  QrCode,
  Award,
  CheckCircle,
  BookOpen,
  Download,
} from 'lucide-react';

import LoadingSpinner from '../components/LoadingSpinner';
import { extractErrorMessage } from '../utils/error';
import { getMyRegistrations } from '../services/registrationService';
import { downloadCertificatePdf } from '../services/attendanceService';
import api from '../services/api';
import type { EventItem, RegistrationItem } from '../types';

function toQrImageUrl(value: string | null | undefined, registrationId?: string) {
  const normalizedValue = value || '';
  if (normalizedValue.startsWith('data:image/')) return normalizedValue;
  if (normalizedValue.startsWith('http://') || normalizedValue.startsWith('https://')) {
    return normalizedValue;
  }

  const backendBase = String(api.defaults.baseURL || 'http://127.0.0.1:5000/api').replace(
    /\/api\/?$/,
    ''
  );
  if (normalizedValue) {
    return `${backendBase}${normalizedValue.startsWith('/') ? normalizedValue : `/${normalizedValue}`}`;
  }
  return registrationId
    ? `${backendBase}/api/attendance/qr-image/${registrationId}?v=${registrationId}`
    : '';
}

export default function MyRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [certLoading, setCertLoading] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState<string | null>(null); // registrationId
  const [qrFallback, setQrFallback] = useState<Record<string, boolean>>({});
  const [qrLoadError, setQrLoadError] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyRegistrations();
      // DEBUG: show QR presence and preview in console to help diagnose display issues
      // Remove or disable logs after debugging
      // eslint-disable-next-line no-console
      console.log(
        '[MyRegistrations] QR debug:',
        data.map((r) => ({
          id: r._id,
          code: r.registrationCode,
          hasQrUrl: !!r.attendanceQr,
          hasQrBase64: !!r.attendanceQrBase64,
          qrStart: (r.attendanceQrBase64 || r.attendanceQr || '').slice(0, 60),
        }))
      );
      setRegistrations(data);
    } catch {
      setError('Could not load registrations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCertificate = async (regId: string) => {
    setCertLoading(regId);
    try {
      await downloadCertificatePdf(regId);
    } catch (error: unknown) {
      alert(extractErrorMessage(error, 'Certificate download failed.'));
    } finally {
      setCertLoading(null);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const now = new Date();

  const StatusBadge = ({ status }: { status?: string }) => {
    if (status === 'waitlisted') {
      return (
        <span
          style={{
            background: 'rgba(168,85,247,0.15)',
            color: '#7c3aed',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Clock size={12} /> Waitlisted
        </span>
      );
    }
    return null;
  };

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
      <h1 style={{ marginBottom: 24, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>
        <BookOpen size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />
        My Registrations
      </h1>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <p style={{ color: '#dc2626' }}>{error}</p>
      ) : registrations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎫</div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>No registrations yet</p>
          <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
            Browse events on your dashboard to register!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {registrations.map((reg) => {
            const event = reg.eventId as EventItem;
            const isPast = event?.date ? new Date(event.date) < now : false;
            const team = reg.team && typeof reg.team !== 'string' ? reg.team : null;
            const teamLeader = team?.leader && typeof team.leader !== 'string' ? team.leader.name : 'Unknown';

            return (
              <div
                key={reg._id}
                style={{
                  background: 'var(--surface-2)',
                  borderRadius: 14,
                  border: '1px solid var(--border)',
                  boxShadow: '0 2px 8px rgba(2,48,71,0.06)',
                  overflow: 'hidden',
                }}
              >
                {/* Card header */}
                <div
                  style={{
                    background: isPast ? 'rgba(148, 163, 184, 0.08)' : 'rgba(108, 99, 255, 0.08)',
                    padding: '12px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--border)',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <h2
                    style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}
                  >
                    {event?.title ?? 'Event Removed'}
                  </h2>
                  <span className={isPast ? 'badge badge-muted' : 'badge badge-primary'}>
                    {isPast ? 'Past' : 'Upcoming'}
                  </span>
                </div>

                {/* Card body */}
                <div
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {/* Event meta */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      flexWrap: 'wrap',
                      fontSize: '0.83rem',
                      color: 'var(--text-muted)',
                      alignItems: 'center',
                    }}
                  >
                    {event?.date && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={14} />
                        {new Date(event.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                    {event?.time && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={14} />
                        {event.time}
                      </span>
                    )}
                    {event?.location && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} />
                        {event.location}
                      </span>
                    )}
                  </div>

                  {/* Registration meta */}
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                    Registered:{' '}
                    {new Date(reg.registeredAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>

                  {/* Status badges row */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    {reg.status === 'waitlisted' ? (
                      <StatusBadge status={reg.status} />
                    ) : (
                      <span
                        style={{
                          background: 'rgba(34,197,94,0.15)',
                          color: 'var(--success)',
                          borderRadius: 8,
                          padding: '5px 11px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <CheckCircle size={12} /> Registered
                      </span>
                    )}
                  </div>

                  {team && (
                    <div
                      style={{
                        border: '1px solid rgba(108,99,255,0.28)',
                        borderRadius: 12,
                        background: 'rgba(108,99,255,0.08)',
                        padding: '13px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Your team</p>
                          <h3 style={{ margin: '3px 0 0', color: 'var(--text)', fontSize: '1rem' }}>{team.teamName}</h3>
                        </div>
                        <span style={{ color: team.status === 'ready' ? 'var(--success)' : '#f59e0b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                          {team.status}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, margin: '12px 0' }}>
                        <div><span style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.68rem' }}>Team code</span><strong style={{ color: '#a5b4fc', fontFamily: 'monospace' }}>{team.teamCode}</strong></div>
                        <div><span style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.68rem' }}>Leader</span><strong style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>{teamLeader}</strong></div>
                        <div><span style={{ display: 'block', color: 'var(--text-dim)', fontSize: '0.68rem' }}>Members</span><strong style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>{team.members.length}/{team.maxTeamSize}</strong></div>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 9 }}>
                        <p style={{ margin: '0 0 7px', color: 'var(--text-dim)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase' }}>Member registrations</p>
                        <div style={{ display: 'grid', gap: 5 }}>
                          {(team.memberRegistrations ?? team.members.map((member) => ({
                            _id: typeof member === 'string' ? member : member._id,
                            userId: member,
                            name: typeof member === 'string' ? 'Member' : member.name,
                            attendanceStatus: 'absent' as const,
                          }))).map((memberRegistration) => {
                            const member = typeof memberRegistration.userId === 'string' ? null : memberRegistration.userId;
                            return (
                              <div key={memberRegistration._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: '0.8rem' }}>
                                <span>{member?.name ?? memberRegistration.name ?? 'Member'}</span>
                                <span style={{ color: memberRegistration.attendanceStatus === 'present' ? 'var(--success)' : 'var(--text-dim)', fontWeight: 700 }}>
                                  {memberRegistration.attendanceStatus === 'present' ? 'Present' : 'Absent'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <p style={{ margin: '10px 0 0', color: 'var(--text-dim)', fontSize: '0.74rem' }}>
                        Event location: <strong style={{ color: 'var(--text-2)' }}>{event?.location || 'TBD'}</strong>
                      </p>
                    </div>
                  )}

                  {reg.registrationCode && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'rgba(79,70,229,0.1)',
                        border: '1px solid rgba(79,70,229,0.25)',
                        borderRadius: 10,
                        padding: '10px 14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <QrCode size={16} color="#818cf8" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.72rem',
                            color: 'var(--text-dim)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          Your Registration Code
                        </p>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '1.05rem',
                            fontWeight: 800,
                            color: '#a5b4fc',
                            letterSpacing: '0.1em',
                          }}
                        >
                          {reg.registrationCode}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-dim)',
                          textAlign: 'right',
                        }}
                      >
                        Show this to admin if QR scan fails
                      </span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                    {reg.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const hasQr = !!(reg.attendanceQrBase64 || reg.attendanceQr);
                            if (!hasQr) {
                              setCertLoading(reg._id);
                              const res = await (
                                await import('../services/registrationService')
                              ).regenerateRegistrationQr(reg._id);
                              if (res?.attendanceQr) {
                                setRegistrations((prev) =>
                                  prev.map((p) =>
                                    p._id === reg._id
                                      ? { ...p, attendanceQr: res.attendanceQr, attendanceQrBase64: res.attendanceQr?.startsWith('data:') ? res.attendanceQr : p.attendanceQrBase64 }
                                      : p
                                  )
                                );
                              }
                              setCertLoading(null);
                              setQrOpen(reg._id);
                              return;
                            }
                            setQrOpen(qrOpen === reg._id ? null : reg._id);
                          } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Regenerate QR failed', e);
                            setCertLoading(null);
                            alert('Could not generate QR. Please try again later.');
                          }
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <QrCode size={14} />{' '}
                        {qrOpen === reg._id
                          ? 'Hide QR'
                          : (reg.attendanceQrBase64 || reg.attendanceQr)
                            ? 'Show QR'
                            : 'Generate QR'}
                      </button>
                    )}

                    {/* Download Certificate */}
                    {reg.attendanceStatus === 'present' && event?.certificatesEnabled && (
                      <button
                        type="button"
                        onClick={() => void handleDownloadCertificate(reg._id)}
                        disabled={certLoading === reg._id}
                        className="btn btn-primary btn-sm"
                      >
                        <Award size={14} />{' '}
                        {certLoading === reg._id ? 'Generating' : 'Download Certificate'}
                      </button>
                    )}

                    {/* Attendance badge */}
                    {reg.attendanceStatus === 'present' && (
                      <span className="badge badge-success">
                        <CheckCircle
                          size={11}
                          style={{ verticalAlign: 'middle', marginRight: 3 }}
                        />
                        Attended
                      </span>
                    )}
                  </div>

                  {/* QR Code Display */}
                  {qrOpen === reg._id && (reg.attendanceQrBase64 || reg.attendanceQr) && (
                    <div
                      style={{
                        marginTop: 12,
                        textAlign: 'center',
                        background: 'var(--surface-2)',
                        borderRadius: 10,
                        padding: '20px 16px',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <p
                        style={{
                          margin: '0 0 12px',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: 'var(--text-2)',
                        }}
                      >
                        📱 Attendance QR Code
                      </p>

                      {qrLoadError[reg._id] ? (
                        <div
                          style={{
                            width: 200,
                            height: 200,
                            margin: '0 auto',
                            border: '1px dashed var(--border)',
                            borderRadius: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(148,163,184,0.05)',
                            color: 'var(--text-dim)',
                            fontSize: '0.8rem',
                            padding: 12,
                            boxSizing: 'border-box',
                          }}
                        >
                          QR could not be loaded. Please try again later.
                        </div>
                      ) : (
                        <img
                          src={toQrImageUrl(
                            qrFallback[reg._id]
                              ? ''
                              : reg.attendanceQrBase64 || reg.attendanceQr,
                            reg._id
                          )}
                          alt="Attendance QR"
                          onError={() => {
                            if (!qrFallback[reg._id] && (reg.attendanceQrBase64 || reg.attendanceQr)) {
                              setQrFallback((prev) => ({ ...prev, [reg._id]: true }));
                            } else {
                              setQrLoadError((prev) => ({ ...prev, [reg._id]: true }));
                            }
                          }}
                          style={{
                            width: 200,
                            height: 200,
                            border: '2px solid var(--border)',
                            borderRadius: 12,
                            background: '#fff',
                            padding: 6,
                          }}
                        />
                      )}

                      <p
                        style={{
                          margin: '12px 0 4px',
                          fontSize: '0.78rem',
                          color: 'var(--text-dim)',
                        }}
                      >
                        Show this to the organizer at the venue — or give your code above if
                        scanning fails.
                      </p>
                      {/* Only show download link for non-base64 URLs (can't download data URI easily) */}
                      {!(reg.attendanceQrBase64 || reg.attendanceQr || '').startsWith('data:') && (
                        <a
                          href={toQrImageUrl(reg.attendanceQr, reg._id)}
                          download={`qr-${reg.registrationCode || reg._id}.png`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            marginTop: 10,
                            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                            color: '#fff',
                            borderRadius: 8,
                            padding: '8px 18px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          <Download size={13} /> Download QR
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import api from '../services/api';

export default function OrganizerApprovalPage() {
  const { action, token } = useParams<{ action: string; token: string }>();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'success' | 'warn' | 'error'>('warn');
  const [heading, setHeading] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function processApproval() {
      if (!action || !token) {
        setStatus('error');
        setHeading('Invalid Link');
        setMessage('The approval link is missing or invalid.');
        setLoading(false);
        return;
      }

      try {
        const targetAction = action.toLowerCase() === 'reject' ? 'reject' : 'approve';
        const res = await api.get<{ msg?: string; heading?: string; status?: string; message?: string }>(
          `/auth/organizer-approval/${targetAction}/${token}`,
          {
            headers: { Accept: 'application/json' },
          }
        );

        if (targetAction === 'approve') {
          setStatus('success');
          setHeading('Organizer Approved!');
          setMessage(res.data?.msg || res.data?.message || 'The organizer has been successfully approved.');
        } else {
          setStatus('error');
          setHeading('Organizer Request Rejected');
          setMessage(res.data?.msg || res.data?.message || 'The organizer request has been rejected.');
        }
      } catch (err: unknown) {
        const errorObj = err as { response?: { data?: { msg?: string; message?: string; heading?: string } }; message?: string };
        const data = errorObj.response?.data;
        const msg = data?.msg || data?.message || errorObj.message || 'Unable to process approval link.';
        
        if (msg.includes('already') || msg.includes('used') || msg.includes('exist')) {
          setStatus('warn');
          setHeading('Link Already Used or Invalid');
          setMessage(msg);
        } else if (msg.includes('expired')) {
          setStatus('warn');
          setHeading('Approval Link Expired');
          setMessage(msg);
        } else {
          setStatus('error');
          setHeading('Action Failed');
          setMessage(msg);
        }
      } finally {
        setLoading(false);
      }
    }

    void processApproval();
  }, [action, token]);

  const iconMap = {
    success: <CheckCircle size={54} color="#10b981" />,
    warn: <AlertTriangle size={54} color="#f59e0b" />,
    error: <XCircle size={54} color="#ef4444" />,
  };

  const colorMap = {
    success: '#10b981',
    warn: '#f59e0b',
    error: '#ef4444',
  };

  return (
    <main
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)',
        padding: '24px',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      <div
        style={{
          background: 'rgba(30, 41, 59, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '40px 32px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        }}
      >
        {loading ? (
          <div style={{ padding: '24px 0' }}>
            <Loader2
              size={48}
              color="#6366f1"
              style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}
            />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
              Processing Organizer Approval…
            </h2>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '20px' }}>{iconMap[status]}</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 12px', color: '#f8fafc' }}>
              {heading}
            </h1>
            <p
              style={{
                fontSize: '0.95rem',
                color: '#94a3b8',
                lineHeight: 1.6,
                margin: '0 0 28px',
              }}
              dangerouslySetInnerHTML={{ __html: message }}
            />
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: colorMap[status],
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '10px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                boxShadow: `0 4px 14px ${colorMap[status]}40`,
                transition: 'transform 0.15s ease',
              }}
            >
              Go to Campus Event Finder <ArrowRight size={16} />
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

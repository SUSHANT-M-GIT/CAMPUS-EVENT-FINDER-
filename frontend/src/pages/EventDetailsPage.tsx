import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { getEventById } from '../services/eventService';
import { registerForEvent } from '../services/registrationService';
import type { EventItem } from '../types';

export default function EventDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadEvent = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const data = await getEventById(id);
        setEvent(data);
      } catch {
        setError('Event not found.');
      } finally {
        setLoading(false);
      }
    };
    void loadEvent();
  }, [id]);

  const eventClosed = Boolean(
    event &&
    (new Date(event.registrationDeadline) < new Date() || new Date(event.date) < new Date())
  );

  const handleRegister = async () => {
    if (!id || eventClosed) return;
    setError('');
    setSuccess('');
    setRegistering(true);
    try {
      const data = await registerForEvent(id);
      setSuccess(data.msg);
    } catch {
      setError('Registration failed. You may already be registered or deadline has passed.');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!event) return <p className="mx-auto max-w-4xl px-4 py-8 text-red-600">{error}</p>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">{event.title}</h1>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium capitalize text-indigo-700">
            {event.type}
          </span>
        </div>
        <p className="mb-6 text-slate-700">{event.description}</p>
        <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <p>Date: {new Date(event.date).toLocaleDateString()}</p>
          <p>Time: {event.time}</p>
          <p>Location: {event.location}</p>
          <p>Registration Deadline: {new Date(event.registrationDeadline).toLocaleString()}</p>
        </div>

        <div className="mt-6">
          {error && <Alert type="error" message={error} />}
          {success && <Alert type="success" message={success} />}
          {user?.role === 'student' && (
            <>
              <button
                onClick={handleRegister}
                disabled={registering || eventClosed}
                className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-70"
              >
                {registering
                  ? 'Registering...'
                  : eventClosed
                    ? 'Registration closed'
                    : 'Register for Event'}
              </button>
              {eventClosed && (
                <p className="mt-3 text-sm text-slate-500">
                  This event is no longer open for registration.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

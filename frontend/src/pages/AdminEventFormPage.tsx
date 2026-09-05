import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../components/Alert';
import { createEvent, getEventById, updateEvent } from '../services/eventService';
import type { EventPayload } from '../services/eventService';

const defaultFormData: EventPayload = {
  title: '',
  about: '',
  description: '',
  eventType: 'individual',
  minTeamSize: null,
  maxTeamSize: null,
  type: 'other',
  date: '',
  time: '',
  registrationDeadline: '',
  location: '',
  maxRegistrations: 100,
  eligibility: 'all',
  tags: [],
};

export default function AdminEventFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [formData, setFormData] = useState(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEdit);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    const loadEvent = async () => {
      if (!id) return;
      try {
        const data = await getEventById(id);
        setFormData({
          title: data.title,
          about: data.about ?? '',
          description: data.description,
          eventType: data.eventType ?? 'individual',
          minTeamSize: data.minTeamSize ?? null,
          maxTeamSize: data.maxTeamSize ?? null,
          type: data.type,
          date: data.date.slice(0, 10),
          time: data.time,
          registrationDeadline: data.registrationDeadline.slice(0, 16),
          location: data.location,
          maxRegistrations: data.maxRegistrations ?? 100,
          eligibility: data.eligibility ?? 'all',
          tags: data.tags ?? [],
        });
      } catch {
        setFeedback({ type: 'error', message: 'Unable to load event.' });
      } finally {
        setPageLoading(false);
      }
    };
    void loadEvent();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  //  FINAL FIXED SUBMIT FUNCTION
  const handleSubmit = async () => {
    //  VALIDATION FIRST

    if (!formData.date || !formData.registrationDeadline) {
      alert(' Please fill all required dates.');
      return;
    }

    if ((formData.about ?? '').trim().split(/\s+/).filter(Boolean).length > 30) {
      alert('About must be 30 words or fewer.');
      return;
    }
    if (formData.eventType === 'team') {
      const min = Number(formData.minTeamSize);
      const max = Number(formData.maxTeamSize);
      if (!Number.isInteger(min) || min < 2 || !Number.isInteger(max) || max < min) {
        alert('Team size must have a minimum of 2 and a maximum greater than or equal to the minimum.');
        return;
      }
    }

    const eventDate = new Date(formData.date);
    const deadlineDate = new Date(formData.registrationDeadline);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);

    if (isNaN(eventDate.getTime()) || isNaN(deadlineDate.getTime())) {
      alert(' Invalid date.');
      return;
    }

    if (eventDate < today) {
      alert('Event date cannot be in the past');
      return;
    }

    if (deadlineDate < today) {
      alert('Registration deadline cannot be in the past');
      return;
    }

    if (deadlineDate > eventDate) {
      alert('Registration deadline cannot be after event date');
      return;
    }

    //  ONLY AFTER VALIDATION
    setLoading(true);
    setFeedback(null);

    try {
      if (isEdit && id) {
        await updateEvent(id, formData);
        setFeedback({ type: 'success', message: 'Event updated successfully.' });
      } else {
        await createEvent(formData);
        setFeedback({ type: 'success', message: 'Event created successfully.' });
      }

      setTimeout(() => navigate('/admin/events'), 1000);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save event.' });
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return <p className="mx-auto max-w-4xl px-4 py-8 text-slate-600">Loading event...</p>;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">
          {isEdit ? 'Edit Event' : 'Create Event'}
        </h1>

        {feedback && <Alert type={feedback.type} message={feedback.message} />}

        {/*  REMOVED onSubmit */}
        <form className="space-y-4">
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Event title"
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />

          <textarea
            name="about"
            value={formData.about}
            onChange={handleChange}
            placeholder="About (short summary, maximum 30 words)"
            className="h-20 w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Full event description"
            className="h-36 w-full rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="hackathon">Hackathon</option>
              <option value="tech">Tech</option>
              <option value="seminar">Seminar</option>
              <option value="games">Games</option>
              <option value="movie">Movie</option>
              <option value="other">Other</option>
            </select>

            <select
              name="eventType"
              value={formData.eventType}
              onChange={handleChange}
              className="rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="individual">Individual Event</option>
              <option value="team">Team Event</option>
            </select>

            <input
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="Location"
              className="rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>

          {formData.eventType === 'team' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                type="number"
                name="minTeamSize"
                min={2}
                value={formData.minTeamSize ?? ''}
                onChange={handleChange}
                placeholder="Minimum team size"
                className="rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <input
                type="number"
                name="maxTeamSize"
                min={2}
                value={formData.maxTeamSize ?? ''}
                onChange={handleChange}
                placeholder="Maximum team size"
                className="rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              className="rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />

            <input
              type="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              className="rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />

            <input
              type="datetime-local"
              name="registrationDeadline"
              value={formData.registrationDeadline}
              onChange={handleChange}
              min={new Date().toISOString().slice(0, 16)}
              className="rounded-md border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>

          {/*  FIXED BUTTON */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-70"
          >
            {loading ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
          </button>
        </form>
      </div>
    </main>
  );
}

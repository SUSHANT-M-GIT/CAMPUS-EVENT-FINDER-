import { Link } from 'react-router-dom';
import type { EventItem } from '../types';

interface EventCardProps {
  event: EventItem;
}

export default function EventCard({ event }: EventCardProps) {
  const now = new Date();
  const eventDate = new Date(event.date);
  const deadline = new Date(event.registrationDeadline);
  const isOngoing = eventDate.toDateString() === now.toDateString();
  const isClosed = eventDate < now && !isOngoing || deadline < now;
  const status = isOngoing ? 'ONGOING' : isClosed ? 'CLOSED' : 'OPEN';
  const maximum = event.maxRegistrations ?? 0;
  const registered = event.registrationCount ?? 0;
  const openSlots = Math.max(maximum - registered, 0);
  const words = event.description.trim().split(/\s+/);
  const shortDescription = words.length > 50
    ? `${words.slice(0, 50).join(' ')}...`
    : event.description;

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          STATUS: {status}
        </span>
        <span className="text-right text-xs font-medium text-slate-500">
          {openSlots} / {maximum} Slots Open
        </span>
      </div>

      <h3 className="mb-4 text-lg font-semibold text-slate-900">{event.title}</h3>

      <div className="mb-4 space-y-2 text-sm text-slate-600">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Administration Name
          </p>
          <p className="font-medium text-slate-700">{event.administrationName || 'Not provided'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Admin Name</p>
          <p className="font-medium text-slate-700">{event.adminName || 'Not provided'}</p>
        </div>
      </div>

      <p className="mb-4 text-sm leading-6 text-slate-600">{shortDescription}</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {(event.tags ?? []).slice(0, 5).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mb-5 space-y-1 text-sm text-slate-600">
        <p>Date: {new Date(event.date).toLocaleDateString()}</p>
        <p>Time: {event.time}</p>
        <p>Location: {event.location}</p>
      </div>

      <div className="mt-auto border-t border-slate-200 pt-4">
        <Link
          to={`/events/${event._id}`}
          aria-label={`More information about ${event.title}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600"
        >
          i
        </Link>
      </div>
    </article>
  );
}

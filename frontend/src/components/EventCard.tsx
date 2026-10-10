import { Calendar, Clock, MapPin, ArrowRight } from 'lucide-react';
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
    <article className="event-card">
      <div className="event-card-body">
        <div className="event-card-topline">
          <span className={`event-status event-status-${status.toLowerCase()}`}>{status}</span>
          <span className="event-card-slots">{openSlots} / {maximum} open</span>
        </div>

        <h3 className="event-card-title">{event.title}</h3>

        <div className="event-card-admin">
          <span>{event.administrationName || 'Campus Events'}</span>
          <span>{event.adminName || 'Event organizer'}</span>
        </div>

        <p className="event-card-description">{shortDescription}</p>

        <div className="event-card-tags">
          {(event.tags ?? []).slice(0, 5).map((tag) => (
            <span key={tag} className="event-tag">{tag}</span>
          ))}
        </div>

        <div className="event-meta event-card-details">
          <span><Calendar size={14} />{new Date(event.date).toLocaleDateString()}</span>
          <span><Clock size={14} />{event.time}</span>
          <span><MapPin size={14} />{event.location}</span>
        </div>

        <div className="event-card-footer">
          <span className="event-card-category">{event.type}</span>
          <Link to={`/events/${event._id}`} aria-label={`More information about ${event.title}`} className="event-card-link">
            View details <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}

import { Link } from "react-router-dom";
import type { EventItem } from "../types";

interface EventCardProps {
  event: EventItem;
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
        <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium capitalize text-indigo-700">
          {event.type}
        </span>
      </div>
      <p className="mb-4 line-clamp-2 text-sm text-slate-600">{event.description}</p>
      <div className="mb-4 space-y-1 text-sm text-slate-600">
        <p>Date: {new Date(event.date).toLocaleDateString()}</p>
        <p>Time: {event.time}</p>
        <p>Location: {event.location}</p>
      </div>
      <Link
        to={`/events/${event._id}`}
        className="inline-flex rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        View Details
      </Link>
    </article>
  );
}

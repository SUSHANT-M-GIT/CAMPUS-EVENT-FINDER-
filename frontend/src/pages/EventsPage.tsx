import { useCallback, useEffect, useMemo, useState } from "react";
import EventCard from "../components/EventCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { getEvents } from "../services/eventService";
import type { EventItem } from "../types";

type SortOption = "deadlineAsc" | "dateAsc" | "dateDesc";

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("deadlineAsc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchEvents = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }
      setError("");
      try {
        const data = await getEvents({ search, type: type || undefined });
        setEvents(data);
      } catch {
        setError("Unable to load events.");
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [search, type],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchEvents(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchEvents]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchEvents(false);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [fetchEvents]);

  const sortedEvents = useMemo(() => {
    const copy = [...events];
    if (sortBy === "dateAsc") {
      copy.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    } else if (sortBy === "dateDesc") {
      copy.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    } else {
      copy.sort((a, b) => +new Date(a.registrationDeadline) - +new Date(b.registrationDeadline));
    }
    return copy;
  }, [events, sortBy]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">Discover Events</h1>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title..."
            className="rounded-md border border-slate-300 px-3 py-2 outline-none ring-indigo-500 focus:ring-2"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 outline-none ring-indigo-500 focus:ring-2"
          >
            <option value="">All Categories</option>
            <option value="hackathon">Hackathon</option>
            <option value="tech">Tech</option>
            <option value="seminar">Seminar</option>
            <option value="games">Games</option>
            <option value="movie">Movie</option>
            <option value="other">Other</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-md border border-slate-300 px-3 py-2 outline-none ring-indigo-500 focus:ring-2"
          >
            <option value="deadlineAsc">Sort: Deadline (Soonest)</option>
            <option value="dateAsc">Sort: Event Date (Earliest)</option>
            <option value="dateDesc">Sort: Event Date (Latest)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : sortedEvents.length === 0 ? (
        <p className="text-sm text-slate-600">No events found for your filter.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedEvents.map((event) => (
            <EventCard key={event._id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}

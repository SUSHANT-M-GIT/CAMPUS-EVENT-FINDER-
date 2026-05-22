import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "../components/Alert";
import LoadingSpinner from "../components/LoadingSpinner";
import { deleteEvent, getEvents } from "../services/eventService";
import type { EventItem } from "../types";

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch {
      setFeedback({ type: "error", message: "Unable to fetch events." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this event?");
    if (!confirmed) return;

    try {
      await deleteEvent(id);
      setFeedback({ type: "success", message: "Event deleted successfully." });
      setEvents((prev) => prev.filter((event) => event._id !== id));
    } catch {
      setFeedback({ type: "error", message: "Delete failed." });
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Admin Event Management</h1>
        <Link to="/admin/events/new" className="rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500">
          Create Event
        </Link>
      </div>

      {feedback && <Alert type={feedback.type} message={feedback.message} />}

      {loading ? (
        <LoadingSpinner />
      ) : events.length === 0 ? (
        <p className="text-slate-600">No events available.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event._id} className="border-t border-slate-200">
                  <td className="px-4 py-3">{event.title}</td>
                  <td className="px-4 py-3 capitalize">{event.type}</td>
                  <td className="px-4 py-3">{new Date(event.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/admin/events/${event._id}/edit`}
                        className="rounded bg-amber-100 px-2 py-1 text-amber-700 hover:bg-amber-200"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(event._id)}
                        className="rounded bg-red-100 px-2 py-1 text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
                      <Link
                        to={`/admin/events/${event._id}/registrations`}
                        className="rounded bg-indigo-100 px-2 py-1 text-indigo-700 hover:bg-indigo-200"
                      >
                        Registrations
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

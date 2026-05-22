import { useEffect, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import { getMyRegistrations } from "../services/registrationService";
import type { EventItem, RegistrationItem } from "../types";

export default function MyRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRegistrations = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getMyRegistrations();
        setRegistrations(data);
      } catch {
        setError("Could not load registrations.");
      } finally {
        setLoading(false);
      }
    };
    void loadRegistrations();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">My Registrations</h1>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : registrations.length === 0 ? (
        <p className="text-slate-600">No registrations yet.</p>
      ) : (
        <div className="space-y-4">
          {registrations.map((registration) => {
            const event = registration.eventId as EventItem;
            return (
              <div key={registration._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">{event?.title ?? "Event Removed"}</h2>
                <p className="text-sm text-slate-600">{event?.location ?? "-"}</p>
                <p className="text-sm text-slate-600">
                  Registered At: {new Date(registration.registeredAt).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

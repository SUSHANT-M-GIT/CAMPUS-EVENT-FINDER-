import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner";
import { getEventRegistrations } from "../services/registrationService";
import type { RegistrationItem } from "../types";

export default function AdminEventRegistrationsPage() {
  const { id } = useParams();
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setLoading(true);
      setError("");
      try {
        const data = await getEventRegistrations(id);
        setRegistrations(data);
      } catch {
        setError("Unable to fetch event registrations.");
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [id]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Event Registrations</h1>
      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : registrations.length === 0 ? (
        <p className="text-slate-600">No users have registered yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Registered At</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((registration) => {
                const user = typeof registration.userId === "string" ? null : registration.userId;
                return (
                  <tr key={registration._id} className="border-t border-slate-200">
                    <td className="px-4 py-3">{user?.name ?? "Unknown"}</td>
                    <td className="px-4 py-3">{user?.email ?? "-"}</td>
                    <td className="px-4 py-3">{new Date(registration.registeredAt).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

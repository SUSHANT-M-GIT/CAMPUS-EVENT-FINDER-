import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { getEventRegistrations } from '../services/registrationService';
import type { RegistrationItem } from '../types';

export default function AdminEventRegistrationsPage() {
  const { id } = useParams();
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const data = await getEventRegistrations(id);
        setRegistrations(data);
      } catch {
        setError('Unable to fetch event registrations.');
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
        (() => {
          const teamGroups = new Map<string, RegistrationItem[]>();
          const individualRegistrations: RegistrationItem[] = [];
          registrations.forEach((registration) => {
            const team = registration.team && typeof registration.team !== 'string' ? registration.team : null;
            if (!team) {
              individualRegistrations.push(registration);
              return;
            }
            const key = team._id;
            teamGroups.set(key, [...(teamGroups.get(key) ?? []), registration]);
          });
          const hasTeams = teamGroups.size > 0;
          const renderRow = (registration: RegistrationItem) => {
            const user = typeof registration.userId === 'string' ? null : registration.userId;
            return (
              <tr key={registration._id} className="border-t border-slate-200">
                <td className="px-4 py-3 font-medium">{user?.name ?? 'Unknown'}</td>
                <td className="px-4 py-3">{user?.email ?? '-'}</td>
                <td className="px-4 py-3">{registration.collegeId ?? '-'}</td>
                <td className="px-4 py-3">{registration.collegeName ?? '-'}</td>
                <td className="px-4 py-3">{registration.department ?? '-'}</td>
                <td className="px-4 py-3 font-semibold">{registration.attendanceStatus === 'present' ? 'P' : 'A'}</td>
              </tr>
            );
          };
          const renderTable = (items: RegistrationItem[]) => (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">College ID</th>
                    <th className="px-4 py-3">College</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">P/A</th>
                  </tr>
                </thead>
                <tbody>{items.map(renderRow)}</tbody>
              </table>
            </div>
          );
          return (
            <div className="space-y-5">
              {Array.from(teamGroups.values()).map((teamRegistrations) => {
                const team = teamRegistrations[0].team;
                if (!team || typeof team === 'string') return null;
                const leader = typeof team.leader === 'string' ? 'Unknown' : team.leader.name;
                return (
                  <section key={team._id} className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
                    <div className="border-b border-indigo-100 bg-indigo-50 px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Team</p>
                          <h2 className="mt-1 text-lg font-bold text-slate-900">{team.teamName}</h2>
                          <p className="mt-1 text-sm text-slate-600">Leader: <strong>{leader}</strong></p>
                        </div>
                        <div className="text-right text-sm text-slate-600">
                          <p>Members: <strong>{team.members.length}/{team.maxTeamSize}</strong></p>
                          <p className="mt-1 font-bold uppercase text-indigo-600">{team.status}</p>
                        </div>
                      </div>
                    </div>
                    {renderTable(teamRegistrations)}
                  </section>
                );
              })}
              {individualRegistrations.length > 0 && (
                <section>
                  {hasTeams && <h2 className="mb-3 text-base font-bold text-slate-800">Individual Registrants</h2>}
                  {renderTable(individualRegistrations)}
                </section>
              )}
            </div>
          );
        })()
      )}
    </main>
  );
}

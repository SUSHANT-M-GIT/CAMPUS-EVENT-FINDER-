import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium ${isActive ? "text-indigo-600" : "text-slate-600 hover:text-slate-900"}`;

  const homePath = user?.role === "admin" ? "/admin/events" : "/events";

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to={homePath} className="text-lg font-bold text-slate-900">
          Campus Events
        </Link>

        <div className="flex items-center gap-4">
          {isAuthenticated && user?.role === "user" && (
            <>
              <NavLink to="/events" className={navClass}>
                Events
              </NavLink>
              <NavLink to="/my-registrations" className={navClass}>
                My Registrations
              </NavLink>
            </>
          )}

          {isAuthenticated && user?.role === "admin" && (
            <>
              <NavLink to="/admin/events" className={navClass}>
                Manage Events
              </NavLink>
              <NavLink to="/admin/events/new" className={navClass}>
                Create Event
              </NavLink>
            </>
          )}

          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-700"
            >
              Logout
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

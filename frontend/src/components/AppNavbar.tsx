import { Link } from "react-router-dom";
import { Zap, Sun, Moon } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { useTheme } from "../context/ThemeContext";

interface NavbarLink {
  label: string;
  href?: string;
  to?: string;
  onClick?: () => void;
}
interface AppNavbarProps {
  links: NavbarLink[];
  showBell?: boolean;
  userName?: string;
  userInitial?: string;
}

export default function AppNavbar({ links, showBell = true, userName, userInitial }: AppNavbarProps) {
  const { toggleTheme, isDark } = useTheme();

  return (
    <header className="dashboard-navbar">
      <div className="app-container dashboard-nav-inner">
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#6C63FF,#A855F7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 16px rgba(108,99,255,0.45)" }}>
            <Zap size={16} color="#fff" fill="#fff" />
          </div>
          <h2 className="brand">CampusEvents</h2>
        </div>

        {/* Nav links */}
        <nav className="dashboard-nav-links" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {links.map((link) => {
            const style: React.CSSProperties = {};
            if (link.to) return <Link key={link.label} to={link.to} style={style}>{link.label}</Link>;
            if (link.href) return <a key={link.label} href={link.href}>{link.label}</a>;
            return <button key={link.label} type="button" onClick={link.onClick}>{link.label}</button>;
          })}

          {/* Dark mode toggle */}
          <button type="button" onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Bell */}
          {showBell && <NotificationBell />}

          {/* Avatar */}
          {userInitial && (
            <div
              title={userName}
              style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF,#A855F7)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "default", flexShrink: 0, boxShadow: "0 0 12px rgba(108,99,255,0.4)" }}
            >
              {userInitial}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

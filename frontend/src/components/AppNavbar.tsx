import { Link, useLocation } from 'react-router-dom';
import { Zap, Sun, Moon, User } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { useTheme } from '../context/ThemeContext';

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

export default function AppNavbar({
  links,
  showBell = true,
  userName,
  userInitial,
}: AppNavbarProps) {
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();

  return (
    <header className="dashboard-navbar" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      <div className="app-container dashboard-nav-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
        {/* Brand Link */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #6C63FF, #A855F7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 16px rgba(108,99,255,0.45)',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Zap size={18} color="#fff" fill="#fff" />
          </div>
          <span className="brand" style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            CampusEvents
          </span>
        </Link>

        {/* Nav links & actions */}
        <nav
          className="dashboard-nav-links"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {links.map((link) => {
            const isActive = link.to ? location.pathname === link.to : false;
            const activeStyle: React.CSSProperties = isActive
              ? {
                  backgroundColor: 'rgba(108, 99, 255, 0.15)',
                  color: '#6C63FF',
                  fontWeight: 600,
                }
              : {};

            if (link.to)
              return (
                <Link key={link.label} to={link.to} style={activeStyle}>
                  {link.label}
                </Link>
              );
            if (link.href)
              return (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              );
            return (
              <button key={link.label} type="button" onClick={link.onClick}>
                {link.label}
              </button>
            );
          })}

          {/* Dark / Light mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label="Toggle theme"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--card-bg)',
              color: 'var(--text)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Notification Bell */}
          {showBell && <NotificationBell />}

          {/* User Profile Avatar Link */}
          {userInitial ? (
            <Link
              to="/profile"
              title={userName ? `${userName} (View Profile)` : 'View Profile'}
              style={{
                textDecoration: 'none',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6C63FF, #A855F7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
                flexShrink: 0,
                boxShadow: '0 0 12px rgba(108,99,255,0.35)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                border: location.pathname === '/profile' ? '2px solid #fff' : '2px solid transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 0 18px rgba(108,99,255,0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(108,99,255,0.35)';
              }}
            >
              {userInitial}
            </Link>
          ) : (
            <Link
              to="/profile"
              title="View Profile"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text)',
                textDecoration: 'none',
              }}
            >
              <User size={18} />
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

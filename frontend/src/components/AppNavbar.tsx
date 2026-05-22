import { Link } from "react-router-dom";

interface NavbarLink {
  label: string;
  href?: string;
  to?: string;
  onClick?: () => void;
}

interface AppNavbarProps {
  links: NavbarLink[];
}

export default function AppNavbar({ links }: AppNavbarProps) {
  return (
    <header className="dashboard-navbar">
      <div className="app-container dashboard-nav-inner">
        <h2 className="brand">Campus Events</h2>
        <nav className="dashboard-nav-links">
          {links.map((link) => {
            if (link.to) {
              return (
                <Link key={link.label} to={link.to}>
                  {link.label}
                </Link>
              );
            }

            if (link.href) {
              return (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              );
            }

            return (
              <button key={link.label} type="button" onClick={link.onClick}>
                {link.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

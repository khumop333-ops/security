/**
 * App chrome: navy header with company identity + fixed bottom navigation.
 * The header always keeps the company visible without overpowering the
 * panic action on the home screen.
 */
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Home, Clock, User, Settings, LayoutDashboard } from 'lucide-react';
import { Logo } from './Logo.jsx';
import { COMPANY } from '../lib/format.js';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/history', label: 'History', icon: Clock },
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export function AppShell({ children }) {
  const location = useLocation();

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <Logo size={38} />
          <div>
            <div className="app-header__name">{COMPANY.name}</div>
            <div className="app-header__tagline">{COMPANY.tagline}</div>
          </div>
          <Link to="/dispatch" className="app-header__action">
            <LayoutDashboard size={16} aria-hidden="true" />
            Dispatch
          </Link>
        </div>
      </header>

      <main>{children}</main>

      <nav className="bottom-nav" aria-label="Primary">
        <div className="bottom-nav__inner">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `bottom-nav__item ${isActive && location.pathname === to ? 'bottom-nav__item--active' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} strokeWidth={1.75} aria-hidden="true" />
                  <span>{label}</span>
                  {isActive ? <span className="sr-only"> (current)</span> : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

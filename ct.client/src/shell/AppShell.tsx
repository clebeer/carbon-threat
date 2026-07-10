import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon, ICONS } from '../ui/primitives';
import { useTheme } from '../ui/theme';
import { useAuthStore } from '../store/authStore';

interface NavItem { to: string; label: string; icon: string; }

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: ICONS.dashboard },
  { to: '/findings', label: 'Findings', icon: ICONS.findings },
  { to: '/engagements', label: 'Engagements', icon: ICONS.engagements },
  { to: '/products', label: 'Products', icon: ICONS.products },
  { to: '/import', label: 'Import Scan', icon: ICONS.import },
  { to: '/report', label: 'Pentest Report', icon: ICONS.report },
  { to: '/connectors', label: 'Connectors', icon: ICONS.connectors },
  { to: '/admin', label: 'Admin', icon: ICONS.admin },
];

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/findings': 'Findings',
  '/engagements': 'Engagements',
  '/products': 'Assets',
  '/import': 'Import Scan',
  '/report': 'Pentest Report',
  '/connectors': 'Connectors',
  '/admin': 'Admin',
};

function Brand() {
  return (
    <div className="cd-brand">
      <span className="cd-brand-badge"><Icon path={ICONS.shield} size={17} strokeWidth={2.2} /></span>
      <span className="cd-brand-name">Carbon Dojo</span>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  // NavLink sets aria-current="page" on the active link automatically; carbon.css
  // styles the active state via .cd-navitem[aria-current='page'].
  return (
    <nav className="cd-nav" aria-label="Primary">
      {NAV.map((item) => (
        <NavLink key={item.to} to={item.to} onClick={onNavigate} className="cd-navitem">
          <Icon path={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function UserCard() {
  const user = useAuthStore((s) => s.user);
  const initial = (user?.email?.[0] ?? 'U').toUpperCase();
  return (
    <div className="cd-sidebar-foot">
      <div className="cd-userrow">
        <div className="cd-avatar">{initial}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email ?? 'user@carbon.local'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{String(user?.role ?? 'Reader')}</div>
        </div>
      </div>
    </div>
  );
}

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const title = TITLES[Object.keys(TITLES).find((p) => location.pathname.startsWith(p)) ?? ''] ?? 'Carbon Dojo';

  function logout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <div className="cd-app">
      {/* Fixed sidebar (desktop) */}
      <aside className="cd-sidebar cd-scroll">
        <Brand />
        <NavList />
        <UserCard />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="cd-drawer-wrap">
          <div className="cd-overlay" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          <aside className="cd-drawer cd-scroll" role="dialog" aria-label="Navigation">
            <Brand />
            <NavList onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="cd-main">
        <header className="cd-topbar">
          <button className="cd-iconbtn cd-hamburger" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
            <Icon path={ICONS.menu} size={18} strokeWidth={2} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="cd-crumb">Acme Corp / Plataforma</div>
            <div className="cd-title">{title}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div className="cd-searchwrap">
            <Icon path={ICONS.search} size={15} strokeWidth={2} />
            <input className="cd-search" placeholder="Search findings, CVEs…" aria-label="Search" />
          </div>
          <button className="cd-iconbtn" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
            <Icon path={theme === 'dark' ? ICONS.sun : ICONS.moon} size={17} />
          </button>
          <button className="cd-btn cd-btn--secondary" onClick={logout}>Logout</button>
        </header>

        <main className="cd-content cd-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

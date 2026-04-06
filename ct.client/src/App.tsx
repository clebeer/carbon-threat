import React, { useState, useEffect } from 'react';
import SetupWizard from './components/Wizard/SetupWizard';
import ThreatFlow from './components/Canvas/ThreatFlow';
import DashboardView from './views/DashboardView';
import ProjectsView from './views/ProjectsView';
import AssetsView from './views/AssetsView';
import ThreatsView from './views/ThreatsView';
import ReportsView from './views/ReportsView';
import AdminView from './views/AdminView';
import SettingsView from './views/SettingsView';
import LoginView from './views/LoginView';
import { useAuthStore } from './store/authStore';
import { refreshSession } from './api/auth';
import { logout } from './api/auth';
import './index.css';

const IconDashboard = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>;
const IconFolder = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
const IconShield = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconActivity = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const IconAdmin = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="5"/><path d="M20 21v-2a7 7 0 0 0-14 0v2"/></svg>;
const IconSettings = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
const IconLogout = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;

const BASE_MENU = [
  { id: 'Dashboard', icon: <IconDashboard /> },
  { id: 'Projects',  icon: <IconFolder />    },
  { id: 'Assets',    icon: <IconFolder />    },
  { id: 'Threats',   icon: <IconShield />    },
  { id: 'Reports',   icon: <IconFolder />    },
];

const ADMIN_MENU = [
  { id: 'Admin',    icon: <IconAdmin />    },
  { id: 'Settings', icon: <IconSettings /> },
];

export default function App() {
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [isSetup, setIsSetup] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [activeModelTitle, setActiveModelTitle] = useState<string>('');

  const { isAuthenticated, user, refreshToken, setAuth, clearAuth } = useAuthStore();

  // On mount: if we have a stored refresh token, restore the in-memory access
  // token.  We always attempt this regardless of isAuthenticated because the
  // access token lives in memory only and is lost on every page reload.
  useEffect(() => {
    const restore = async () => {
      if (refreshToken) {
        try {
          const { useAuthStore: store } = await import('./store/authStore');
          const newAccessToken = await refreshSession();
          const current = store.getState();
          if (current.user) {
            setAuth(current.user, newAccessToken, current.refreshToken!);
          }
        } catch {
          clearAuth();
        }
      }
      setBootstrapping(false);
    };
    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Setup wizard gate — check /api/config/setup-status to see if wizard has been completed
  useEffect(() => {
    const done = localStorage.getItem('carbonthreat_setup_complete');
    if (done) { setIsSetup(true); return; }
    fetch('/api/config/setup-status')
      .then(r => r.json())
      .then(data => {
        if (data?.status === 'configured') {
          localStorage.setItem('carbonthreat_setup_complete', 'true');
          setIsSetup(true);
        } else {
          setIsSetup(false);
        }
      })
      .catch(() => setIsSetup(false));
  }, []);

  async function handleLogout() {
    await logout();
    clearAuth();
  }

  function handleOpenModel(id: string, title: string) {
    setActiveModelId(id);
    setActiveModelTitle(title);
    setActiveMenu('Modeling');
  }

  const renderView = () => {
    switch (activeMenu) {
      case 'Dashboard': return <DashboardView />;
      case 'Projects': return <ProjectsView onOpenModel={handleOpenModel} />;
      case 'Assets': return <AssetsView />;
      case 'Threats': return <ThreatsView />;
      case 'Modeling': return <ThreatFlow modelId={activeModelId} modelTitle={activeModelTitle} />;
      case 'Reports': return <ReportsView />;
      case 'Admin': return <AdminView />;
      case 'Settings': return <SettingsView />;
      default: return <DashboardView />;
    }
  };

  // 1. Wait for session restore attempt
  if (bootstrapping) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', background: 'var(--surface-dim)', color: 'var(--on-surface-muted)', fontSize: '14px', letterSpacing: '0.5px' }}>
        Loading…
      </div>
    );
  }

  // 2. First-run setup wizard
  if (!isSetup) {
    return <SetupWizard onComplete={() => setIsSetup(true)} />;
  }

  // 3. Authentication gate
  if (!isAuthenticated) {
    return <LoginView onSuccess={() => { /* isAuthenticated will update via store */ }} />;
  }

  const displayName = user?.email?.split('@')[0] ?? 'User';
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '';

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '260px', height: '100%', zIndex: 10, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.05)', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', borderRadius: 0 }}>
        <div style={{ padding: '24px 24px 40px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold', fontSize: '18px' }}>C</div>
          <h2 style={{ margin: 0, fontSize: '20px', fontFamily: 'var(--font-display)', fontWeight: 600, color: '#fff' }}>Carbon<span className="glow-text-cyan">Threat</span></h2>
        </div>

        <div style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column' }}>
          {/* Base menu — all authenticated users */}
          {BASE_MENU.map(item => (
            <div
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
                marginBottom: '4px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                background: activeMenu === item.id ? 'rgba(0, 242, 255, 0.1)' : 'transparent',
                color: activeMenu === item.id ? 'var(--primary)' : 'var(--on-surface-muted)',
                fontWeight: activeMenu === item.id ? 600 : 400,
              }}
            >
              {item.icon}
              <span style={{ fontSize: '14px', letterSpacing: '0.5px' }}>{item.id}</span>
            </div>
          ))}

          {/* Admin-only menu — separator + admin items */}
          {user?.role === 'admin' && (
            <>
              <div style={{ margin: '12px 8px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }} />
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px', padding: '0 8px', margin: '0 0 6px 0', fontFamily: 'var(--font-label)' }}>ADMIN</p>
              {ADMIN_MENU.map(item => (
                <div
                  key={item.id}
                  onClick={() => setActiveMenu(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
                    marginBottom: '4px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                    background: activeMenu === item.id ? 'rgba(0, 242, 255, 0.1)' : 'transparent',
                    color: activeMenu === item.id ? 'var(--primary)' : 'var(--on-surface-muted)',
                    fontWeight: activeMenu === item.id ? 600 : 400,
                  }}
                >
                  {item.icon}
                  <span style={{ fontSize: '14px', letterSpacing: '0.5px' }}>{item.id}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Logged-in user card at the bottom */}
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,242,255,0.15)', border: '1px solid rgba(0,242,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
              {displayName[0]?.toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayName}</div>
              <div style={{ fontSize: '11px', color: 'var(--on-surface-muted)' }}>{roleLabel}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: 'var(--on-surface-muted)', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <IconLogout /> Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div className="glass-panel" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '64px', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeMenu === 'Modeling' && (
              <button
                onClick={() => setActiveMenu('Projects')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--on-surface-muted)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.5px', transition: 'all 0.2s' }}
              >
                ← Projects
              </button>
            )}
            <span style={{ color: 'var(--on-surface-muted)', fontSize: '14px', letterSpacing: '0.5px' }}>
              {activeMenu === 'Modeling' && activeModelTitle ? activeModelTitle : activeMenu}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '13px', color: 'var(--on-surface-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconAdmin /> {user?.email}
              {user?.role === 'admin' && <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'rgba(0,242,255,0.12)', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.5px' }}>ADMIN</span>}
            </span>
          </div>
        </div>

        {renderView()}
      </div>
    </div>
  );
}

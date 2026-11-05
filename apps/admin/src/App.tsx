import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { projectConfig, ta } from '@bair/project-data';
import { get, onSignedOut, post } from './lib/api';
import { go, useLocation } from './lib/router';
import type { AuthState, Me, Role } from './lib/types';
import { Spinner, ToastProvider } from './ui/kit';
import { Login } from './pages/Login';
import { Icon, type IconName } from './ui/icons';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const Units = lazy(() => import('./pages/Units'));
const Parking = lazy(() => import('./pages/Parking'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const Audit = lazy(() => import('./pages/Audit'));

const RANK: Record<Role, number> = { sales: 0, admin: 1, superadmin: 2 };

interface Session {
  me: Me;
  can: (role: Role) => boolean;
}
const SessionCtx = createContext<Session | null>(null);
export const useSession = () => useContext(SessionCtx)!;

const NAV: { path: string; label: string; icon: IconName; role: Role }[] = [
  { path: 'dashboard', label: ta.nav.dashboard, icon: 'home', role: 'sales' },
  { path: 'leads', label: ta.nav.leads, icon: 'users', role: 'sales' },
  { path: 'units', label: ta.nav.units, icon: 'grid', role: 'sales' },
  { path: 'parking', label: ta.nav.parking, icon: 'car', role: 'sales' },
  { path: 'analytics', label: ta.nav.analytics, icon: 'chart', role: 'sales' },
  { path: 'users', label: ta.nav.users, icon: 'key', role: 'superadmin' },
  { path: 'settings', label: ta.nav.settings, icon: 'cog', role: 'sales' },
  { path: 'audit', label: ta.nav.audit, icon: 'list', role: 'superadmin' },
];

export function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const refresh = useCallback(() => get<AuthState>('/api/auth/state').then(setAuth, () => setAuth({ user: null, needsSetup: false, setupEnabled: false, kdf: { iterations: 0 } })), []);
  useEffect(() => {
    void refresh();
    return onSignedOut(() => setAuth((a) => (a ? { ...a, user: null } : a)));
  }, [refresh]);

  return <ToastProvider>{!auth ? <Spinner /> : auth.user ? <Shell me={auth.user} onLogout={refresh} /> : <Login state={auth} onDone={refresh} />}</ToastProvider>;
}

function Shell({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const can = useCallback((role: Role) => RANK[me.role] >= RANK[role], [me.role]);
  const page = loc.parts[0] ?? 'dashboard';
  const nav = NAV.filter((n) => can(n.role));
  const current = nav.find((n) => n.path === page) ? page : 'dashboard';

  useEffect(() => setMenu(false), [loc.parts]);

  const logout = async () => {
    await post('/api/auth/logout').catch(() => undefined);
    onLogout();
  };

  const pages: Record<string, ReactNode> = {
    dashboard: <Dashboard />,
    leads: <Leads />,
    units: <Units />,
    parking: <Parking />,
    analytics: <Analytics />,
    users: <Users />,
    settings: <Settings />,
    audit: <Audit />,
  };

  const navList = (
    <nav aria-label={ta.nav.menu} className="flex flex-col gap-0.5">
      {nav.map((n) => (
        <a
          key={n.path}
          href={`#/${n.path}`}
          aria-current={current === n.path ? 'page' : undefined}
          className={`flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold transition-colors ${
            current === n.path ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
          }`}
        >
          <Icon name={n.icon} />
          {n.label}
        </a>
      ))}
    </nav>
  );

  const profile = (
    <div className="border-t border-[var(--line)] pt-3">
      <div className="px-3 text-sm font-bold">{me.name}</div>
      <div className="px-3 text-xs text-[var(--ink-3)]">{ta.role[me.role]}</div>
      <div className="mt-2 flex flex-col gap-0.5">
        <a href="../showroom/" target="_blank" rel="noreferrer" className="flex min-h-9 items-center gap-3 rounded-[10px] px-3 text-sm font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]">
          <Icon name="cube" />
          {ta.app.showroom}
        </a>
        <button type="button" onClick={logout} className="flex min-h-9 items-center gap-3 rounded-[10px] px-3 text-left text-sm font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]">
          <Icon name="logout" />
          {ta.nav.logout}
        </button>
      </div>
    </div>
  );

  const brand = (
    <a href="#/dashboard" className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-extrabold text-white" style={{ background: projectConfig.brand.accent }}>
        {projectConfig.developerLogoInitials}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-extrabold">{projectConfig.projectName}</span>
        <span className="block text-xs text-[var(--ink-3)]">{ta.app.title}</span>
      </span>
    </a>
  );

  return (
    <SessionCtx.Provider value={{ me, can }}>
      <div className="min-h-dvh lg:pl-60">
        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-5 border-r border-[var(--line)] bg-[var(--surface)] p-3 lg:flex">
          <div className="pt-1">{brand}</div>
          <div className="flex-1 overflow-y-auto">{navList}</div>
          {profile}
        </aside>

        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-3 lg:hidden">
          {brand}
          <button type="button" aria-label={ta.nav.menu} aria-expanded={menu} onClick={() => setMenu(!menu)} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-[var(--surface-2)]">
            <Icon name="menu" />
          </button>
        </header>
        {menu && (
          <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMenu(false)}>
            <div className="drawer-in ml-auto flex h-full w-72 max-w-[85vw] flex-col gap-4 bg-[var(--surface)] p-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex-1 overflow-y-auto pt-2">{navList}</div>
              {profile}
            </div>
          </div>
        )}

        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          <Suspense fallback={<Spinner />}>{pages[current]}</Suspense>
        </main>
      </div>
    </SessionCtx.Provider>
  );
}

/** Sends people who open a page their role does not allow back to the dashboard. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { can } = useSession();
  useEffect(() => {
    if (!can(role)) go('dashboard');
  }, [can, role]);
  return can(role) ? <>{children}</> : null;
}

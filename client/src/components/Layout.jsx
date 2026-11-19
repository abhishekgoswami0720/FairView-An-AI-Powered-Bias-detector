import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/format';

const NAV = {
  hr: [
    ['/hr', 'Overview'],
    ['/hr/gap-cards', 'Gap Cards'],
    ['/hr/people', 'People'],
    ['/projects', 'Projects'],
    ['/hr/audit', 'Audit log'],
  ],
  manager: [
    ['/review', 'Review work'],
    ['/projects', 'Projects'],
    ['/team', 'My team'],
  ],
  employee: [
    ['/work', 'My work'],
    ['/record', 'My record'],
  ],
};

export function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xl font-extrabold tracking-tight ${className}`}>
      <svg width="30" height="20" viewBox="0 0 30 20" aria-hidden="true">
        <line x1="6" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="2.5" />
        <rect x="1" y="5" width="10" height="10" rx="2" fill="var(--color-mgr)" />
        <circle cx="23" cy="10" r="4.6" fill="var(--color-paper)" stroke="var(--color-cli)" strokeWidth="3" />
      </svg>
      FairView
    </span>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const links = NAV[user.role] || [];
  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {links.map(([to, label]) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/hr'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `rounded-control px-3 py-2 font-semibold ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5'}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
  const account = (
    <div className="border-t border-rule pt-4 text-sm">
      <p className="font-semibold">{user.name}</p>
      <p className="text-muted">
        {ROLE_LABEL[user.role]}, {user.orgName}
      </p>
      <button onClick={logout} className="mt-3 font-semibold text-mgr underline underline-offset-4">
        Log out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="hidden border-r border-rule md:flex md:min-h-screen md:flex-col md:justify-between md:p-5">
        <div className="flex flex-col gap-8">
          <Logo />
          {nav}
        </div>
        {account}
      </aside>

      <header className="flex items-center justify-between border-b border-rule px-4 py-3 md:hidden">
        <Logo />
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded px-3 py-1.5 font-semibold ring-1 ring-rule">
          Menu
        </button>
      </header>
      {open && (
        <div className="flex flex-col gap-5 border-b border-rule bg-surface p-4 md:hidden">
          {nav}
          {account}
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 md:py-12">
        <Outlet />
      </main>
    </div>
  );
}

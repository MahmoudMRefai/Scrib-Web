import type { ReactNode } from 'react';
import { Feather, LogOut, type LucideIcon } from 'lucide-react';
import { useAuth, useSession } from '../auth/AuthContext';
import { initials } from '../lib/format';
import type { Role } from '../api/types';
import type { Tone } from '../lib/status';

export interface NavItem<K extends string> {
  key: K;
  label: string;
  icon: LucideIcon;
  badge?: number | null;
}

const ROLE: Record<Role, { label: string; tone: Tone }> = {
  ADMIN: { label: 'Hub admin', tone: 'gold' },
  MERCHANT: { label: 'Merchant', tone: 'violet' },
  COURIER: { label: 'Courier', tone: 'teal' },
};

export function Logo() {
  return (
    <div className="brand-mark">
      <Feather size={20} strokeWidth={2.4} />
    </div>
  );
}

export function Shell<K extends string>({
  nav,
  active,
  onNavigate,
  children,
}: {
  nav: NavItem<K>[];
  active: K;
  onNavigate: (key: K) => void;
  children: ReactNode;
}) {
  const { user } = useSession();
  const { logout } = useAuth();
  const role = ROLE[user.role];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <div>
            <div className="brand-name">Scribe</div>
            <div className="brand-sub">Armant Hub</div>
          </div>
        </div>
        <div className="nav-label">{role.label} workspace</div>
        <nav className="nav" aria-label="Main">
          {nav.map((item) => (
            <button
              key={item.key}
              id={`nav-${item.key}`}
              className={`nav-item ${active === item.key ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
              title={item.label}
              aria-current={active === item.key ? 'page' : undefined}
            >
              <item.icon size={18} />
              <span className="nav-text">{item.label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="user-card">
          <div className={`avatar tone-${role.tone}`}>{initials(user.name)}</div>
          <div className="user-meta">
            <div className="user-name">{user.name}</div>
            <div className="user-email">{user.email}</div>
          </div>
          <button id="logout-btn" className="btn btn-ghost btn-icon btn-sm" onClick={logout} title="Sign out" aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main fade-in" key={active}>
        {children}
      </main>
    </div>
  );
}

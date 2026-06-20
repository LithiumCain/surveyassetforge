import { ReactNode } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { User } from '../types';

export type Tab = 'dashboard' | 'reports';

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  regional_director: 'Regional Director',
  site_supervisor: 'Site Supervisor',
};

type Props = {
  user: User;
  tab: Tab;
  onTab: (tab: Tab) => void;
  children?: ReactNode; // page-specific right-side actions
};

export const TopBar = ({ user, tab, onTab, children }: Props) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'User';

  const tabButton = (key: Tab, label: string) => (
    <button
      type="button"
      onClick={() => onTab(key)}
      style={{
        background: tab === key ? 'rgba(255,255,255,0.18)' : 'transparent',
        color: '#ffffff',
        border: 'none',
        padding: '7px 16px',
        borderRadius: 9,
        cursor: 'pointer',
        fontWeight: tab === key ? 700 : 500,
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-logo">SAF</div>
        <div>
          <h1>Survey Asset Forge</h1>
          <p>
            {user.organization?.name ? `${user.organization.name} · ` : ''}
            {name} · {roleLabel[user.role] ?? user.role}
          </p>
        </div>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          {tabButton('dashboard', 'Dashboard')}
          {tabButton('reports', 'Reports')}
        </nav>
      </div>
      <div className="topbar-right">
        {children}
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
};

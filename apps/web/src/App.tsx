import { useCallback, useEffect, useState } from 'react';
import { SignedIn, SignedOut, SignIn, useAuth, useUser } from '@clerk/clerk-react';
import { apiClient } from './api/client';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { TeamPage } from './pages/TeamPage';
import type { Tab } from './components/TopBar';
import { User } from './types';

export const App = () => (
  <>
    <SignedOut>
      <main className="login-page center">
        <div className="login card">
          <div className="login-brand">
            <div className="topbar-logo">SAF</div>
            <div>
              <h2>Survey Asset Forge</h2>
              <p>Field Operations Asset Management</p>
            </div>
          </div>
          <div className="login-divider" />
          <SignIn routing="hash" />
        </div>
      </main>
    </SignedOut>

    <SignedIn>
      <AuthedApp />
    </SignedIn>
  </>
);

// Rendered only when Clerk reports a signed-in session. Loads the SAF user
// (resolved from the Clerk identity by the API) and hands off to the dashboard.
const AuthedApp = () => {
  const { getToken, signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');

  const loadMe = useCallback(() => {
    setBooting(true);
    setError(null);
    apiClient
      .getMe()
      .then(setUser)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load your account'))
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    apiClient.setTokenGetter(() => getToken());
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (booting) {
    return (
      <main className="layout center">
        <p>Loading…</p>
      </main>
    );
  }

  if (error || !user) {
    const email = clerkUser?.primaryEmailAddress?.emailAddress;
    return (
      <main className="login-page center">
        <div className="login card" style={{ maxWidth: 460 }}>
          <div className="login-brand">
            <div className="topbar-logo">SAF</div>
            <div>
              <h2>Survey Asset Forge</h2>
              <p>Field Operations Asset Management</p>
            </div>
          </div>
          <div className="login-divider" />
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>We couldn&apos;t load your account</h3>
            <p>{error ?? 'Your account is not set up yet.'}</p>
            {/* The API message above names the actual cause and the next step. Don't
                append generic advice here — "ask an administrator to add this email"
                is wrong for, say, an invitation that was never accepted. */}
            {email ? (
              <p style={{ color: 'var(--muted, #64748b)', fontSize: '0.9rem' }}>
                You&apos;re signed in as <strong>{email}</strong>.
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              <button onClick={loadMe}>Try again</button>
              <button className="secondary-button" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return tab === 'reports' ? (
    <ReportsPage user={user} onTab={setTab} />
  ) : tab === 'team' ? (
    <TeamPage user={user} onTab={setTab} />
  ) : (
    <DashboardPage user={user} onTab={setTab} />
  );
};

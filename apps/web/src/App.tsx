import { useEffect, useState } from 'react';
import { SignedIn, SignedOut, SignIn, useAuth } from '@clerk/clerk-react';
import { apiClient } from './api/client';
import { DashboardPage } from './pages/DashboardPage';
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
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.setTokenGetter(() => getToken());
    apiClient
      .getMe()
      .then(setUser)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load your account'))
      .finally(() => setBooting(false));
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
    return (
      <main className="layout center">
        <div className="card" style={{ textAlign: 'center', maxWidth: 420 }}>
          <p>{error ?? 'Your account is not set up yet.'}</p>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      </main>
    );
  }

  return <DashboardPage user={user} onLogout={() => void signOut()} />;
};

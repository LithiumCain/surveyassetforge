import { useEffect, useState } from 'react';
import { apiClient } from './api/client';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { User } from './types';

const tokenStorageKey = 'hartsystem_token';

export const App = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem(tokenStorageKey));
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    apiClient.setToken(token);
    if (!token) {
      setBooting(false);
      return;
    }

    apiClient
      .getMe()
      .then((me) => setUser(me))
      .catch(() => {
        localStorage.removeItem(tokenStorageKey);
        setToken(null);
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, [token]);

  const handleLogin = async (username: string, password: string): Promise<void> => {
    const response = await apiClient.login(username, password);
    apiClient.setToken(response.token);
    localStorage.setItem(tokenStorageKey, response.token);
    setToken(response.token);
    setUser(response.user);
  };

  const handleLogout = (): void => {
    localStorage.removeItem(tokenStorageKey);
    setUser(null);
    setToken(null);
    apiClient.setToken(null);
  };

  if (booting) {
    return <main className="layout center"><p>Loading...</p></main>;
  }

  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <DashboardPage user={user} onLogout={handleLogout} />;
};

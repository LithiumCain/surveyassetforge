import { FormEvent, useState } from 'react';

type Props = {
  onLogin: (username: string, password: string) => Promise<void>;
};

export const LoginPage = ({ onLogin }: Props) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page center">
      <form className="login card" onSubmit={submit}>
        <div className="login-brand">
          <div className="topbar-logo">SAF</div>
          <div>
            <h2>SurveyAssetForge</h2>
            <p>Field Operations Asset Management</p>
          </div>
        </div>

        <div className="login-divider" />

        {error && <p className="error">{error}</p>}

        <label className="field-label">
          <span>Username</span>
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="field-label">
          <span>Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button type="submit" disabled={loading} className="login-btn">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="login-footer">Qcells USA · Midwest Survey Operations</p>
      </form>
    </main>
  );
};

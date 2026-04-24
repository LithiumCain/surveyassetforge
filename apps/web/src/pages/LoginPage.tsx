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
    <main className="layout center">
      <form className="card login" onSubmit={submit}>
        <h1>FieldOps Asset Dashboard</h1>
        <p>Sign in with your assigned account.</p>
        {error && <p className="error">{error}</p>}
        <label>Username<input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} /></label>
        <label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
      </form>
    </main>
  );
};

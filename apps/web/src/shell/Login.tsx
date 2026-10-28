import { useState } from 'react';
import { actions } from '../tasks/store';

// Shown instead of the app until Leo has entered the password the server was started with.
export function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void actions.login(password).then((problem) => {
            setBusy(false);
            setError(problem);
            if (!problem) setPassword('');
          });
        }}
      >
        <span className="brand-number">
          204<span>.</span>
        </span>
        <h1>Masuk sebagai Leo</h1>
        <p className="section-note">
          Kantor ini hanya untuk pemiliknya. Kata sandinya ada di file{' '}
          <code>.env</code> (OWNER_PASSWORD) di folder proyek.
        </p>
        <label htmlFor="owner-password">Kata sandi</label>
        <input
          id="owner-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p className="task-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button-dark"
          type="submit"
          disabled={busy || password.length === 0}
        >
          {busy ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}

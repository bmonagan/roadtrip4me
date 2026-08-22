import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Known seeded identities (see apps/api/prisma/seed.ts). Shown only in dev
// mode (Auth0 not configured); these map to the API's x-user-id fallback.
const DEV_USERS = [
  {
    id: 'user_alice',
    displayName: 'Alice Wanderer',
    email: 'alice@example.com',
    badge: 'Premium',
  },
  {
    id: 'user_bob',
    displayName: 'Bob Roadrunner',
    email: 'bob@example.com',
    badge: 'Free',
  },
];

export default function LoginPage() {
  const { authMode, devUserId, switchUser, login } = useAuth();
  const navigate = useNavigate();
  const [customId, setCustomId] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Real auth provider — hand off to Auth0.
  if (authMode === 'auth0') {
    return (
      <div className="page">
        <h1>Log in</h1>
        <p className="muted">Sign in with your account to continue.</p>
        <button type="button" className="btn primary" onClick={login}>
          Continue to login
        </button>
      </div>
    );
  }

  const select = (id: string) => {
    switchUser(id);
    navigate('/', { replace: true });
  };

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const id = customId.trim();
    if (!id) return;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      setError('User ID may only contain letters, numbers, _ and -.');
      return;
    }
    select(id);
  };

  return (
    <div className="page">
      <h1>Log in</h1>
      <p className="muted">
        Authentication is running in development mode. Choose who you are.
      </p>

      <ul className="card-list">
        {DEV_USERS.map((u) => (
          <li key={u.id} className="card login-user">
            <div className="card-body">
              <h3>
                {u.displayName}{' '}
                {u.badge === 'Premium' && <span className="badge premium">⭐ Premium</span>}
              </h3>
              <p className="muted">{u.email}</p>
            </div>
            <button
              type="button"
              className="btn small primary"
              onClick={() => select(u.id)}
              disabled={devUserId === u.id}
            >
              {devUserId === u.id ? 'Signed in' : 'Sign in'}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={submitCustom} className="login-custom">
        <label>
          <span>Or use a custom user ID</span>
          <input
            type="text"
            value={customId}
            onChange={(e) => {
              setCustomId(e.target.value);
              setError(null);
            }}
            placeholder="user_alice"
            maxLength={64}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn" disabled={!customId.trim()}>
          Sign in
        </button>
      </form>
    </div>
  );
}

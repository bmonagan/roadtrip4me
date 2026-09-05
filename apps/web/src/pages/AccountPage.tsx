import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '../lib/api';

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

export default function AccountPage() {
  const { authMode, isAuthenticated, devUserId, switchUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.users.me(),
    enabled: isAuthenticated,
  });

  const { data: billing } = useQuery({
    queryKey: ['billing/status'],
    queryFn: () => api.billing.status(),
    enabled: isAuthenticated && authMode === 'auth0',
  });

  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription?')) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await api.billing.cancel();
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['billing/status'] });
    } catch (e) {
      setCancelError((e as ApiError).message);
    } finally {
      setCancelling(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const selectDevUser = (id: string) => {
    switchUser(id);
    const redirect = sessionStorage.getItem('roadtrip4me.redirect');
    sessionStorage.removeItem('roadtrip4me.redirect');
    navigate(redirect && redirect.startsWith('/') ? redirect : '/', { replace: true });
  };

  if (authMode === 'dev') {
    return (
      <div className="page">
        <h1>Account</h1>
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
                onClick={() => selectDevUser(u.id)}
                disabled={devUserId === u.id}
              >
                {devUserId === u.id ? 'Signed in' : 'Sign in'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="page">
        <h1>Account</h1>
        <p className="muted">Log in to manage your account, trips, and subscription.</p>
        <div className="account-actions">
          <Link to="/login" className="btn primary">Log in</Link>
          <Link to="/signup" className="btn">Create an account</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Account</h1>

      <div className="card account-profile">
        <div className="card-body">
          <div className="account-avatar-row">
            {me?.avatarUrl ? (
              <img src={me.avatarUrl} alt="" className="account-avatar" />
            ) : (
              <div className="account-avatar account-avatar-fallback">
                {(me?.displayName ?? me?.email ?? '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h3>{me?.displayName}</h3>
              <p className="muted">{me?.email}</p>
            </div>
          </div>
          <div className="account-badge-row">
            {me?.isPremium ? (
              <span className="badge premium">⭐ Premium</span>
            ) : (
              <span className="badge">Free</span>
            )}
          </div>
        </div>
      </div>

      <section className="account-section">
        <h2>Subscription</h2>
        {billing?.isPremium ? (
          <>
            <p className="muted">You are on the Premium plan. Enjoy unlimited trips, stops, AI recommendations, and collaborations.</p>
            {billing.stripeCustomerId ? (
              <button
                type="button"
                className="btn danger"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Canceling...' : 'Cancel Subscription'}
              </button>
            ) : null}
            {cancelError && <p className="error">{cancelError}</p>}
          </>
        ) : (
          <>
            <p className="muted">
              You are on the Free plan — up to 3 trips, 5 stops per trip, no AI recommendations.
            </p>
            <Link to="/premium" className="btn primary">Go Premium</Link>
          </>
        )}
      </section>

      <section className="account-section">
        <h2>Session</h2>
        <button type="button" className="btn" onClick={handleLogout}>
          Log out
        </button>
      </section>
    </div>
  );
}

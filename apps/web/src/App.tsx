import { NavLink, Link, Route, Routes, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from './auth/AuthContext';
import { api } from './lib/api';
import TripsPage from './pages/TripsPage';
import TripDetailPage from './pages/TripDetailPage';
import TripFormPage from './pages/TripFormPage';
import StopsPage from './pages/StopsPage';
import CallbackPage from './pages/CallbackPage';
import LegalPage from './pages/LegalPage';
import CookieConsent from './components/CookieConsent';

export default function App() {
  const { isAuthenticated, authMode, login, logout } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.users.me(),
    staleTime: Infinity,
  });

  // After a successful Stripe checkout the user returns with ?upgraded=1.
  useEffect(() => {
    if (searchParams.get('upgraded')) {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      searchParams.delete('upgraded');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, queryClient]);

  const checkout = useMutation({
    mutationFn: () => api.billing.checkout(),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
  });

  return (
    <>
      <header className="site-header">
        <NavLink to="/" className="brand">
          🚗 Roadtrip4me
        </NavLink>
        <nav className="site-nav">
          <NavLink to="/trips">Trips</NavLink>
          <NavLink to="/stops">Stops</NavLink>
        </nav>
        <div className="site-auth">
          {me?.isPremium ? (
            <span className="badge premium">⭐ Premium</span>
          ) : (
            isAuthenticated &&
            authMode === 'auth0' && (
              <button
                type="button"
                className="btn small"
                onClick={() => checkout.mutate()}
                disabled={checkout.isPending}
              >
                Go Premium
              </button>
            )
          )}
          {authMode === 'auth0' &&
            (isAuthenticated ? (
              <button type="button" className="btn small" onClick={logout}>
                Log out
              </button>
            ) : (
              <button type="button" className="btn small primary" onClick={login}>
                Log in
              </button>
            ))}
        </div>
      </header>
      <main className="site-main">
        <Routes>
          <Route path="/" element={<TripsPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/new" element={<TripFormPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="/trips/:id/edit" element={<TripFormPage />} />
          <Route path="/stops" element={<StopsPage />} />
          <Route path="/terms" element={<LegalPage kind="terms" />} />
          <Route path="/privacy" element={<LegalPage kind="privacy" />} />
          <Route path="/auth/callback" element={<CallbackPage />} />
        </Routes>
      </main>
      <footer className="site-footer">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
        <span className="muted">© {new Date().getFullYear()} Roadtrip4me</span>
      </footer>
      <CookieConsent />
    </>
  );
}

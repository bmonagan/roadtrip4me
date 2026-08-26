import { lazy, Suspense, useEffect, useRef } from 'react';
import { NavLink, Link, Route, Routes, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth/AuthContext';
import { api } from './lib/api';
import { ToastProvider } from './lib/useToast';
import HomePage from './pages/HomePage';
import CookieConsent from './components/CookieConsent';
import ToastContainer from './components/ToastContainer';

// Route-level code splitting: each page (and its heavy deps like mapbox-gl)
// loads only when navigated to, keeping the initial bundle small.
const TripsPage = lazy(() => import('./pages/TripsPage'));
const TripDetailPage = lazy(() => import('./pages/TripDetailPage'));
const TripFormPage = lazy(() => import('./pages/TripFormPage'));
const StopsPage = lazy(() => import('./pages/StopsPage'));
const CallbackPage = lazy(() => import('./pages/CallbackPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const PremiumPage = lazy(() => import('./pages/PremiumPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

export default function App() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { authMode, isAuthenticated, token } = useAuth();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.users.me(),
    // Refetch when the auth token changes (login/logout/switch user) so the
    // header and premium badge always reflect the active identity.
    staleTime: Infinity,
    enabled: isAuthenticated,
  });

  // After a successful Stripe checkout the user returns with ?upgraded=1.
  useEffect(() => {
    if (searchParams.get('upgraded')) {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['billing/status'] });
      searchParams.delete('upgraded');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, queryClient]);

  // Clear the cache when the auth identity changes so stale data from a
  // previous user/login is never shown to the next one.
  const prevToken = useRef(token);
  useEffect(() => {
    if (prevToken.current !== token) {
      queryClient.clear();
      prevToken.current = token;
    }
  }, [token, queryClient]);

  return (
    <ToastProvider>
      <>
        <header className="site-header">
          <NavLink to="/" className="brand">
            <img src="/favicon.svg" alt="" className="brand-logo" width="28" height="28" />
            Roadtrip4me
          </NavLink>
          <nav className="site-nav">
            <NavLink to="/trips">Trips</NavLink>
            <NavLink to="/stops">Stops</NavLink>
            {me?.isAdmin && <NavLink to="/admin">Admin</NavLink>}
          </nav>
          <div className="site-auth">
            {me?.isPremium && <span className="badge premium">⭐ Premium</span>}
            {isAuthenticated ? (
              <Link to="/account" className="btn small account-link">
                {me?.avatarUrl ? (
                  <img src={me.avatarUrl} alt="" className="account-avatar-sm" />
                ) : (
                  <span className="account-avatar-sm account-avatar-fallback-sm">
                    {(me?.displayName ?? me?.email ?? 'A').charAt(0).toUpperCase()}
                  </span>
                )}
                <span>Account</span>
              </Link>
            ) : authMode === 'auth0' ? (
              <>
                <Link to="/signup" className="btn small">
                  Sign up
                </Link>
                <Link to="/login" className="btn small primary">
                  Log in
                </Link>
              </>
            ) : null}
          </div>
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="*"
            element={
              <main className="site-main">
                <Suspense
                  fallback={
                    <div className="page">
                      <p className="muted">Loading…</p>
                    </div>
                  }
                >
                  <Routes>
                    <Route path="/trips" element={<TripsPage />} />
                    <Route path="/trips/new" element={<TripFormPage />} />
                    <Route path="/trips/:id" element={<TripDetailPage />} />
                    <Route path="/trips/:id/edit" element={<TripFormPage />} />
                    <Route path="/stops" element={<StopsPage />} />
                    <Route path="/terms" element={<LegalPage kind="terms" />} />
                    <Route path="/privacy" element={<LegalPage kind="privacy" />} />
                    <Route path="/auth/callback" element={<CallbackPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/premium" element={<PremiumPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                  </Routes>
                </Suspense>
              </main>
            }
          />
        </Routes>
        <footer className="site-footer">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <span className="muted">© {new Date().getFullYear()} Roadtrip4me</span>
        </footer>
        <CookieConsent />
        <ToastContainer />
      </>
    </ToastProvider>
  );
}

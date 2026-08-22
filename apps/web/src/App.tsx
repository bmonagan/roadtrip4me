import { NavLink, Link, Route, Routes, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from './auth/AuthContext';
import { api } from './lib/api';
import { ToastProvider } from './lib/useToast';
import TripsPage from './pages/TripsPage';
import TripDetailPage from './pages/TripDetailPage';
import TripFormPage from './pages/TripFormPage';
import StopsPage from './pages/StopsPage';
import HomePage from './pages/HomePage';
import CallbackPage from './pages/CallbackPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import LegalPage from './pages/LegalPage';
import PremiumPage from './pages/PremiumPage';
import CookieConsent from './components/CookieConsent';
import ToastContainer from './components/ToastContainer';

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
      queryClient.invalidateQueries({ queryKey: ['billing/status'] });
      searchParams.delete('upgraded');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, queryClient]);

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
          </nav>
          <div className="site-auth">
            {me?.isPremium ? (
              <span className="badge premium">⭐ Premium</span>
            ) : (
              isAuthenticated &&
              authMode === 'auth0' && (
                <Link to="/premium" className="btn small">Go Premium</Link>
              )
            )}
            {authMode === 'auth0' &&
              (isAuthenticated ? (
                <button type="button" className="btn small" onClick={logout}>
                  Log out
                </button>
              ) : (
                <>
                  <Link to="/signup" className="btn small">
                    Sign up
                  </Link>
                  <button type="button" className="btn small primary" onClick={login}>
                    Log in
                  </button>
                </>
              ))}
            {authMode === 'dev' && (
              <Link to="/login" className="btn small">
                {isAuthenticated ? 'Switch account' : 'Log in'}
              </Link>
            )}
          </div>
        </header>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="*"
            element={
              <main className="site-main">
                <Routes>
                  <Route path="/trips" element={<TripsPage />} />
                  <Route path="/trips/new" element={<TripFormPage />} />
                  <Route path="/trips/:id" element={<TripDetailPage />} />
                  <Route path="/trips/:id/edit" element={<TripFormPage />} />
                  <Route path="/stops" element={<StopsPage />} />
                  <Route path="/terms" element={<LegalPage kind="terms" />} />
                  <Route path="/privacy" element={<LegalPage kind="privacy" />} />
                  <Route path="/auth/callback" element={<CallbackPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/premium" element={<PremiumPage />} />
                </Routes>
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

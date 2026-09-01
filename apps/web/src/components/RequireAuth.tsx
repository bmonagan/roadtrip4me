import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * Guards a route so signed-out users are redirected to /login with their
 * intended destination preserved (via sessionStorage) so they land back where
 * they were after authenticating.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const from = location.pathname + location.search;
    if (!sessionStorage.getItem('roadtrip4me.redirect')) {
      sessionStorage.setItem('roadtrip4me.redirect', from);
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

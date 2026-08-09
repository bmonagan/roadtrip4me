import { NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import TripsPage from './pages/TripsPage';
import TripDetailPage from './pages/TripDetailPage';
import TripFormPage from './pages/TripFormPage';
import StopsPage from './pages/StopsPage';
import CallbackPage from './pages/CallbackPage';

export default function App() {
  const { isAuthenticated, authMode, login, logout } = useAuth();

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
          <Route path="/auth/callback" element={<CallbackPage />} />
        </Routes>
      </main>
    </>
  );
}

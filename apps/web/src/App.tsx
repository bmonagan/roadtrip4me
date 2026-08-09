import { NavLink, Route, Routes } from 'react-router-dom';
import TripsPage from './pages/TripsPage';
import TripDetailPage from './pages/TripDetailPage';
import TripFormPage from './pages/TripFormPage';
import StopsPage from './pages/StopsPage';

export default function App() {
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
      </header>
      <main className="site-main">
        <Routes>
          <Route path="/" element={<TripsPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/new" element={<TripFormPage />} />
          <Route path="/trips/:id" element={<TripDetailPage />} />
          <Route path="/trips/:id/edit" element={<TripFormPage />} />
          <Route path="/stops" element={<StopsPage />} />
        </Routes>
      </main>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { Stop } from '@roadtrip4me/types';
import { api } from '../lib/api';
import { formatDistance, titleCase } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import VoteButtons from '../components/VoteButtons';
import AddToTrip from '../components/AddToTrip';
import AddStopForm from '../components/AddStopForm';
import LoadingBanner from '../components/LoadingBanner';

const CATEGORIES = [
  'restaurant',
  'attraction',
  'gas_station',
  'lodging',
  'park',
  'viewpoint',
  'campground',
  'museum',
  'shopping',
  'other',
] as const;

type NearbyStop = Stop & { distanceMeters: number };

export default function StopsPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  // Debounced copy of `query` — the API request fires only after typing pauses,
  // not on every keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['stops', category, debouncedQuery],
    queryFn: () => api.stops.list({ pageSize: 50, category, q: debouncedQuery }),
  });

  const openAddForm = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setShowAddForm((v) => !v);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Stops</h1>
        <button
          type="button"
          className="btn primary"
          onClick={openAddForm}
        >
          {showAddForm ? 'Cancel' : '+ Add stop'}
        </button>
      </div>

      {showAddForm && isAuthenticated && <AddStopForm onDone={() => setShowAddForm(false)} />}

      <div className="toolbar">
        <label className="muted">
          Category{' '}
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {titleCase(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="muted" aria-label="Search stops, city, state">
          <input
            type="search"
            className="stop-search"
            placeholder="Search stops, city, state…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      <NearbyStops authenticated={isAuthenticated} />

      {isLoading ? (
        <LoadingBanner message="Loading stops…" />
      ) : isError ? (
        <p className="error">{(error as Error).message}</p>
      ) : (
        <ul className="card-list">
          {(data?.data ?? []).map((stop) => (
            <StopCard key={stop.id} stop={stop} authenticated={isAuthenticated} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StopCard({ stop, authenticated }: { stop: Stop; authenticated: boolean }) {
  return (
    <li className="card">
      {authenticated ? (
        <VoteButtons stop={stop} />
      ) : (
        <Link to="/login" className="btn small">
          Log in to vote
        </Link>
      )}
      <div className="card-body">
        <h3>{stop.name}</h3>
        <p className="muted">
          {stop.address.city}, {stop.address.state} · {titleCase(stop.category)}
        </p>
        {stop.description && <p className="stop-description">{stop.description}</p>}
      </div>
      {authenticated ? (
        <AddToTrip stopId={stop.id} />
      ) : (
        <Link to="/login" className="btn small">
          Log in to add
        </Link>
      )}
    </li>
  );
}

function NearbyStops({ authenticated }: { authenticated: boolean }) {
  const [nearby, setNearby] = useState<NearbyStop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  const findNearby = () => {
    setError(null);
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const results = await api.stops.nearby({
            lat: latitude,
            lng: longitude,
            radiusMeters: 50_000,
          });
          if (mounted.current) setNearby(results);
        } catch (e) {
          if (mounted.current) setError((e as Error).message);
        } finally {
          if (mounted.current) setLoading(false);
        }
      },
      (err) => {
        if (mounted.current) {
          setError(`Location unavailable: ${err.message}`);
          setLoading(false);
        }
      }
    );
  };

  const loginTo = () => {
    if (!sessionStorage.getItem('roadtrip4me.redirect')) {
      sessionStorage.setItem(
        'roadtrip4me.redirect',
        window.location.pathname + window.location.search
      );
    }
  };

  return (
    <section className="nearby">
      <h2>Nearby</h2>
      <button type="button" className="primary" onClick={findNearby} disabled={loading}>
        {loading ? 'Locating…' : nearby ? 'Refresh nearby' : 'Find stops near me'}
      </button>
      {error && <p className="error">{error}</p>}
      {nearby && nearby.length > 0 && (
        <ul className="card-list">
          {nearby.map((stop) => (
            <li key={stop.id} className="card">
              {authenticated ? (
                <VoteButtons stop={stop} />
              ) : (
                <Link to="/login" className="btn small" onClick={loginTo}>
                  Log in to vote
                </Link>
              )}
              <div className="card-body">
                <h3>{stop.name}</h3>
                <p className="muted">
                  {formatDistance(stop.distanceMeters)} away · {titleCase(stop.category)}
                </p>
              </div>
              {authenticated ? (
                <AddToTrip stopId={stop.id} />
              ) : (
                <Link to="/login" className="btn small" onClick={loginTo}>
                  Log in to add
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

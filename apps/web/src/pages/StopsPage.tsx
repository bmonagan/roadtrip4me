import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Stop } from '@roadtrip4me/types';
import { api } from '../lib/api';
import { formatDistance, titleCase } from '../lib/format';
import VoteButtons from '../components/VoteButtons';

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
  const [category, setCategory] = useState<string>('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['stops', category],
    queryFn: () => api.stops.list({ pageSize: 50, category }),
  });

  return (
    <div className="page">
      <h1>Stops</h1>
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
      </div>

      <NearbyStops />

      {isLoading ? (
        <p className="muted">Loading stops…</p>
      ) : isError ? (
        <p className="error">{(error as Error).message}</p>
      ) : (
        <ul className="card-list">
          {(data?.data ?? []).map((stop) => (
            <StopCard key={stop.id} stop={stop} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StopCard({ stop }: { stop: Stop }) {
  return (
    <li className="card">
      <VoteButtons stop={stop} />
      <div className="card-body">
        <h3>{stop.name}</h3>
        <p className="muted">
          {stop.address.city}, {stop.address.state} · {titleCase(stop.category)}
        </p>
        {stop.description && <p className="stop-description">{stop.description}</p>}
      </div>
    </li>
  );
}

function NearbyStops() {
  const [nearby, setNearby] = useState<NearbyStop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          setNearby(results);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(`Location unavailable: ${err.message}`);
        setLoading(false);
      }
    );
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
              <VoteButtons stop={stop} />
              <div className="card-body">
                <h3>{stop.name}</h3>
                <p className="muted">
                  {formatDistance(stop.distanceMeters)} away · {titleCase(stop.category)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

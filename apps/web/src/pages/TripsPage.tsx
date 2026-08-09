import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { TripSummary } from '@roadtrip4me/types';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

export default function TripsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['trips'],
    queryFn: () => api.trips.list({ pageSize: 50 }),
  });

  if (isLoading) return <p className="muted">Loading trips…</p>;
  if (isError) return <p className="error">{(error as Error).message}</p>;

  return (
    <div className="page">
      <h1>My Trips</h1>
      {data && data.data.length === 0 ? (
        <p className="muted">No trips yet.</p>
      ) : (
        <ul className="card-list">
          {(data?.data ?? []).map((trip) => (
            <li key={trip.id}>
              <Link to={`/trips/${trip.id}`} className="card">
                <div className="card-body">
                  <h3>{trip.title}</h3>
                  <p className="muted">
                    {trip.origin} → {trip.destination}
                  </p>
                </div>
                <dl className="card-meta">
                  <div>
                    <dt>Status</dt>
                    <dd>{trip.status}</dd>
                  </div>
                  <div>
                    <dt>Stops</dt>
                    <dd>{trip.stopCount}</dd>
                  </div>
                  <div>
                    <dt>Start</dt>
                    <dd>{formatDate(trip.startDate)}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { TripSummary };

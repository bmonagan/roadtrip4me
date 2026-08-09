import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatDuration, titleCase } from '../lib/format';
import TripMap from '../components/TripMap';

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: trip,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => api.trips.get(id!),
    enabled: !!id,
  });

  if (isLoading) return <p className="muted">Loading trip…</p>;
  if (isError) return <p className="error">{(error as Error).message}</p>;
  if (!trip) return null;

  return (
    <div className="page">
      <Link to="/trips" className="back-link">
        ← Back to trips
      </Link>
      <header className="trip-header">
        <h1>{trip.title}</h1>
        <span className={`badge status-${trip.status}`}>{titleCase(trip.status)}</span>
        <p className="muted">
          {trip.origin.label} → {trip.destination.label}
        </p>
        <p className="muted">
          {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
          {trip.totalDistanceMeters ? ` · ${formatDuration(trip.totalDurationSeconds)} drive` : ''}
        </p>
        {trip.vibes.length > 0 && (
          <p>
            {trip.vibes.map((vibe) => (
              <span key={vibe} className="badge vibe">
                {vibe}
              </span>
            ))}
          </p>
        )}
      </header>

      <TripMap trip={trip} />

      <section className="stops-section">
        <h2>Stops ({trip.stops.length})</h2>
        <ol className="stop-list">
          {trip.stops.map((stop) => (
            <li key={stop.id} className="stop-item">
              <span className="stop-order">{stop.name}</span>
              <div>
                <p className="muted">
                  {stop.address.city}, {stop.address.state} · {titleCase(stop.category)}
                </p>
                {stop.description && <p>{stop.description}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

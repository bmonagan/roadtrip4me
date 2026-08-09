import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatDuration, titleCase } from '../lib/format';
import TripMap from '../components/TripMap';
import Recommendations from '../components/Recommendations';

const ROUTE_POLL_MS = 1500;
const ROUTE_POLL_MAX = 20;

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // Route computation is async (BullMQ) — refetch until the polyline appears.
  const routePollAttempts = useRef(0);
  const hasRoute = Boolean(trip?.encodedPolyline);
  useEffect(() => {
    if (!id || hasRoute) return;
    const interval = setInterval(() => {
      if (routePollAttempts.current++ >= ROUTE_POLL_MAX) {
        clearInterval(interval);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['trip', id] });
    }, ROUTE_POLL_MS);
    return () => clearInterval(interval);
  }, [id, hasRoute, queryClient]);

  const removeStop = useMutation({
    mutationFn: (stopId: string) => api.trips.removeStop(id!, stopId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['trip', id], updated);
    },
  });

  const removeTrip = useMutation({
    mutationFn: () => api.trips.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate('/trips');
    },
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
        <div className="trip-title-row">
          <h1>{trip.title}</h1>
          <div className="trip-actions">
            <Link to={`/trips/${trip.id}/edit`} className="btn">
              Edit
            </Link>
            <button
              type="button"
              className="btn danger"
              onClick={() => removeTrip.mutate()}
              disabled={removeTrip.isPending}
            >
              {removeTrip.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
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

      <Recommendations trip={trip} />

      <section className="stops-section">
        <h2>
          Stops ({trip.stops.length})
          <Link to="/stops" className="btn small">
            + Add stop
          </Link>
        </h2>
        {trip.stops.length === 0 ? (
          <p className="muted">No stops yet — browse the stops page to add some.</p>
        ) : (
          <ol className="stop-list">
            {trip.stops.map((stop) => (
              <li key={stop.id} className="stop-item">
                <div className="stop-item-body">
                  <span className="stop-order">{stop.name}</span>
                  <p className="muted">
                    {stop.address.city}, {stop.address.state} · {titleCase(stop.category)}
                  </p>
                  {stop.description && <p>{stop.description}</p>}
                </div>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => removeStop.mutate(stop.id)}
                  disabled={removeStop.isPending}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

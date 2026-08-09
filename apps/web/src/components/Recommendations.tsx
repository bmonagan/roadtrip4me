import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Trip } from '@roadtrip4me/types';
import { api, type RecommendedStop } from '../lib/api';
import { formatDistance, titleCase } from '../lib/format';

export default function Recommendations({ trip }: { trip: Trip }) {
  const queryClient = useQueryClient();
  const [recs, setRecs] = useState<RecommendedStop[] | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const fetchRecs = async () => {
    setRequesting(true);
    setError(null);
    try {
      const results = await api.trips.recommendations(trip.id, {
        vibes: trip.vibes,
        maxDetourMinutes: 30,
        preferences: {},
      });
      setRecs(results);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRequesting(false);
    }
  };

  const add = useMutation({
    mutationFn: async (rec: RecommendedStop) => {
      const stop = await api.stops.create({
        name: rec.name,
        description: rec.description,
        category: rec.category,
        coordinates: rec.coordinates,
        address: { city: rec.city, state: rec.state },
      });
      await api.trips.addStop(trip.id, stop.id);
      return rec;
    },
    onSuccess: (rec) => {
      setAdded((prev) => new Set(prev).add(rec.name));
      queryClient.invalidateQueries({ queryKey: ['trip', trip.id] });
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section className="recommendations">
      <div className="recommendations-head">
        <h2>AI Recommendations</h2>
        <button type="button" className="btn small" onClick={fetchRecs} disabled={requesting}>
          {requesting ? 'Thinking…' : recs ? 'Refresh' : 'Get recommendations'}
        </button>
      </div>
      <p className="muted">
        Stops suggested along your route from {trip.origin.label} to {trip.destination.label}
        {trip.vibes.length > 0 ? `, tuned to: ${trip.vibes.join(', ')}` : ''}.
      </p>

      {error && <p className="error">{error}</p>}

      {requesting && <p className="muted">Asking the AI…</p>}

      {recs && !requesting && (
        <ul className="rec-list">
          {recs.map((rec, i) => (
            <li key={`${rec.name}-${i}`} className="card rec-card">
              <div className="card-body">
                <h3>
                  {rec.name} <span className="badge vibe">{titleCase(rec.category)}</span>
                </h3>
                <p className="muted">
                  {rec.city}, {rec.state} · {formatDistance(rec.distanceFromRouteMeters)} from route
                </p>
                {rec.description && <p className="stop-description">{rec.description}</p>}
                <p className="rec-reasoning">💡 {rec.reasoning}</p>
              </div>
              <button
                type="button"
                className="btn small"
                onClick={() => add.mutate(rec)}
                disabled={add.isPending || added.has(rec.name)}
              >
                {added.has(rec.name) ? '✓ Added' : 'Add to trip'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

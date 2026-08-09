import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Trip } from '@roadtrip4me/types';
import { api, type RecommendedStop } from '../lib/api';
import { formatDistance, titleCase } from '../lib/format';

const POLL_INTERVAL_MS = 1500;

export default function Recommendations({ trip }: { trip: Trip }) {
  const queryClient = useQueryClient();
  const [recs, setRecs] = useState<RecommendedStop[] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'processing' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // Poll the job until it completes or fails.
  useEffect(() => {
    if (phase !== 'processing') return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await api.trips.recommendations.status(trip.id);
        if (cancelled) return;
        if (res.status === 'completed') {
          setRecs(res.data);
          setPhase('idle');
          return;
        }
        if (res.status === 'failed') {
          setError(res.message ?? 'Recommendations failed');
          setPhase('failed');
          return;
        }
        if (res.status === 'processing' && attempts++ < 40) {
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setPhase('idle');
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setPhase('failed');
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [phase, trip.id]);

  const start = async () => {
    setError(null);
    setRecs(null);
    setPhase('processing');
    try {
      await api.trips.recommendations.enqueue(trip.id, {
        vibes: trip.vibes,
        maxDetourMinutes: 30,
        preferences: {},
      });
    } catch (e) {
      setError((e as Error).message);
      setPhase('failed');
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
        <button
          type="button"
          className="btn small"
          onClick={start}
          disabled={phase === 'processing'}
        >
          {phase === 'processing' ? 'Thinking…' : recs ? 'Refresh' : 'Get recommendations'}
        </button>
      </div>
      <p className="muted">
        Stops suggested along your route from {trip.origin.label} to {trip.destination.label}
        {trip.vibes.length > 0 ? `, tuned to: ${trip.vibes.join(', ')}` : ''}.
      </p>

      {error && <p className="error">{error}</p>}
      {phase === 'processing' && <p className="muted">Asking the AI…</p>}

      {recs && (
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

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Trip } from '@roadtrip4me/types';
import { api, type RecommendedStop } from '../lib/api';
import { formatDistance, titleCase } from '../lib/format';
import { useToast } from '../lib/useToast';

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_ATTEMPTS = 40;

export default function Recommendations({ trip }: { trip: Trip }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [recs, setRecs] = useState<RecommendedStop[] | null>(null);
  const [phase, setPhase] = useState<'idle' | 'processing' | 'failed'>('idle');
  const [added, setAdded] = useState<Set<string>>(new Set());

  // Poll the job while phase === 'processing'. Driven by state (not a ref) so
  // starting a run re-triggers this effect and the poll actually begins.
  useEffect(() => {
    if (phase !== 'processing') return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await api.trips.recommendations.status(trip.id);
        if (cancelled) return;
        if (res.status === 'completed') {
          setRecs(res.data);
          setPhase('idle');
          toast({ message: `${res.data.length} recommendations ready!`, type: 'success' });
          return;
        }
        if (res.status === 'failed') {
          setPhase('failed');
          toast({ message: res.message ?? 'Recommendations failed', type: 'error' });
          return;
        }
        if (attempts++ < MAX_POLL_ATTEMPTS) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setPhase('idle');
          toast({ message: 'Recommendations timed out', type: 'warning' });
        }
      } catch (e) {
        if (!cancelled) {
          setPhase('failed');
          toast({ message: (e as Error).message, type: 'error' });
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, trip.id, toast]);

  const cancel = () => {
    setPhase('idle');
  };

  const start = useMutation({
    mutationFn: async () => {
      setRecs(null);
      setAdded(new Set());
      setPhase('processing');
      return api.trips.recommendations.enqueue(trip.id, {
        vibes: trip.vibes,
        maxDetourMinutes: 30,
        preferences: {},
      });
    },
    onSuccess: () => {
      toast({ message: 'Generating recommendations…', type: 'info' });
    },
    onError: (e) => {
      setPhase('idle');
      toast({ message: (e as Error).message, type: 'error' });
    },
  });

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
      toast({ message: `${rec.name} added to trip`, type: 'success' });
    },
    onError: (e) => {
      toast({ message: (e as Error).message, type: 'error' });
    },
  });

  return (
    <section className="recommendations">
      <div className="recommendations-head">
        <h2>AI Recommendations</h2>
        {phase === 'processing' ? (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className="muted">Thinking…</span>
            <button
              type="button"
              className="btn small"
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn small"
            onClick={() => start.mutate()}
            disabled={start.isPending}
          >
            {start.isPending ? 'Thinking…' : recs ? 'Refresh' : 'Get recommendations'}
          </button>
        )}
      </div>
      <p className="muted">
        Stops suggested along your route from {trip.origin.label} to {trip.destination.label}
        {trip.vibes.length > 0 ? `, tuned to: ${trip.vibes.join(', ')}` : ''}.
      </p>

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
                {added.has(rec.name) ? '✓ Added' : add.isPending ? 'Adding…' : 'Add to trip'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

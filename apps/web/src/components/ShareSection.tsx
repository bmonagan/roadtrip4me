import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Trip } from '@roadtrip4me/types';
import { api } from '../lib/api';

export default function ShareSection({ trip }: { trip: Trip }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.users.me(),
    staleTime: Infinity,
  });

  const isOwner = me?.id === trip.userId;
  const applyTrip = (updated: Trip) => {
    queryClient.setQueryData(['trip', trip.id], updated);
    queryClient.invalidateQueries({ queryKey: ['trips'] });
  };

  const add = useMutation({
    mutationFn: () => api.trips.addCollaborator(trip.id, email.trim()),
    onSuccess: (updated) => {
      setEmail('');
      setError(null);
      applyTrip(updated);
    },
    onError: (e) => setError((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.trips.removeCollaborator(trip.id, userId),
    onSuccess: (updated) => applyTrip(updated),
  });

  return (
    <section className="stops-section">
      <h2>Shared with</h2>
      {trip.collaborators.length === 0 ? (
        <p className="muted">Not shared yet.</p>
      ) : (
        <ul className="card-list">
          {trip.collaborators.map((c) => (
            <li key={c.userId} className="card">
              <div className="card-body">
                <h3>{c.displayName}</h3>
                <p className="muted">{c.email}</p>
              </div>
              {isOwner && (
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => remove.mutate(c.userId)}
                  disabled={remove.isPending}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner && (
        <div className="waypoint-add">
          <label className="place-search">
            <span>Share with (email)</span>
            <input
              type="email"
              value={email}
              placeholder="friend@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn primary"
            onClick={() => add.mutate()}
            disabled={!email.trim() || add.isPending}
          >
            Share
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

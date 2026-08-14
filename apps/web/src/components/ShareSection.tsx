import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Trip } from '@roadtrip4me/types';
import { api } from '../lib/api';
import { useToast } from '../lib/useToast';

export default function ShareSection({ trip }: { trip: Trip }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const { toast } = useToast();

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
      applyTrip(updated);
      toast({ message: `${email.trim()} added as collaborator`, type: 'success' });
    },
    onError: (e) => toast({ message: (e as Error).message, type: 'error' }),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => api.trips.removeCollaborator(trip.id, userId),
    onSuccess: (updated) => {
      applyTrip(updated);
      toast({ message: 'Collaborator removed', type: 'success' });
    },
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
    </section>
  );
}

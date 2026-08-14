import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../lib/useToast';

export default function AddToTrip({ stopId }: { stopId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: trips } = useQuery({
    queryKey: ['trips'],
    queryFn: () => api.trips.list({ pageSize: 50 }),
  });

  const add = useMutation({
    mutationFn: (tripId: string) => api.trips.addStop(tripId, stopId),
    onSuccess: () => {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast({ message: 'Added to trip', type: 'success' });
    },
    onError: (e) => toast({ message: (e as Error).message, type: 'error' }),
  });

  return (
    <div className="add-to-trip">
      <button type="button" className="btn small" onClick={() => setOpen((v) => !v)}>
        + Add to trip
      </button>
      {open && (
        <ul className="trip-picker">
          {trips && trips.data.length === 0 && <li className="muted">No trips yet</li>}
          {(trips?.data ?? []).map((trip) => (
            <li key={trip.id}>
              <button type="button" onClick={() => add.mutate(trip.id)} disabled={add.isPending}>
                {trip.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

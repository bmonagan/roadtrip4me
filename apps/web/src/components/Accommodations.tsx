import { useQuery } from '@tanstack/react-query';
import type { Trip } from '@roadtrip4me/types';
import { api } from '../lib/api';
import AccommodationList from './AccommodationList';

export default function Accommodations({ trip }: { trip: Trip }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['accommodations', trip.id],
    queryFn: () => api.trips.accommodations(trip.id),
    enabled: trip.stops.length > 0,
  });

  if (trip.stops.length === 0) return null;
  if (isLoading) return <p className="muted">Loading accommodations…</p>;
  if (isError) return <p className="error">Unable to load accommodation recommendations.</p>;
  if (!data || data.length === 0) return null;

  return (
    <section className="stops-section">
      <h2>Where to stay</h2>
      <AccommodationList cards={data} />
    </section>
  );
}

import { useQuery } from '@tanstack/react-query';
import type { Trip } from '@roadtrip4me/types';
import { api } from '../lib/api';
import AffiliateCardSections from './AffiliateCardSections';

export default function Accommodations({ trip }: { trip: Trip }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['accommodations', trip.id],
    queryFn: () => api.trips.accommodations(trip.id),
    enabled: trip.stops.length > 0,
  });

  if (trip.stops.length === 0) return null;
  if (isLoading) return <p className="muted">Loading recommendations…</p>;
  if (isError) return <p className="error">Unable to load recommendations.</p>;
  if (!data || data.length === 0) return null;

  return <AffiliateCardSections cards={data} />;
}

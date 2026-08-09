import { useQuery } from '@tanstack/react-query';
import type { Trip } from '@roadtrip4me/types';
import { api } from '../lib/api';

export default function Accommodations({ trip }: { trip: Trip }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['accommodations', trip.id],
    queryFn: () => api.trips.accommodations(trip.id),
    enabled: trip.stops.length > 0,
  });

  if (trip.stops.length === 0) return null;
  if (isLoading) return <p className="muted">Loading accommodations…</p>;
  if (isError) return null;
  if (!data || data.length === 0) return null;

  return (
    <section className="stops-section">
      <h2>Where to stay</h2>
      <ul className="card-list">
        {data.map((card, i) => (
          <li key={`${card.provider}-${i}`} className="card">
            <div className="card-body">
              <h3>{card.name}</h3>
              <p className="muted">{card.provider === 'booking_com' ? 'Booking.com' : 'Expedia'}</p>
            </div>
            <a
              href={card.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="btn primary"
            >
              View deals
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

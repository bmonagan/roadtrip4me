import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { GeocodeResult } from '../lib/geocode';
import PlaceSearch from './PlaceSearch';
import AccommodationList from './AccommodationList';

/**
 * Hotels for a destination the user picks. Coordinates are forwarded to the API
 * so the live inventory provider can use them; without a chosen city there is
 * nothing to search on (reverse-geocoding would add a paid API call).
 */
export default function NearbyAccommodations() {
  const [place, setPlace] = useState<GeocodeResult | null>(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['accommodations', 'nearby', place?.label],
    queryFn: () => api.accommodations.nearby({ city: place!.label, lat: place!.lat, lng: place!.lng }),
    enabled: !!place,
  });

  return (
    <section className="stops-section">
      <h2>Where to stay</h2>
      <PlaceSearch label="Search hotels by city" value={place} onSelect={setPlace} />
      {isFetching && <p className="muted">Finding hotels…</p>}
      {isError && <p className="error">Unable to load hotel recommendations.</p>}
      {!isFetching && data && data.length > 0 && <AccommodationList cards={data} />}
      {!isFetching && data && data.length === 0 && (
        <p className="muted">No hotel links available for this destination yet.</p>
      )}
    </section>
  );
}

// A single accommodation lookup: a human-readable destination (used for
// provider search/deeplinks) plus the coordinates it resolves to (used by the
// live inventory APIs and for the card's map pin).
export interface AccommodationQuery {
  destination: string;
  lat: number;
  lng: number;
}

/** Joins a city/state pair into the destination string providers expect. */
export function destinationLabel(city: string, state?: string | null): string {
  return state ? `${city}, ${state}` : city;
}

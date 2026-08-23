import type { TripPlace } from './api';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export type GeocodeResult = TripPlace;

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  if (!MAPBOX_TOKEN) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&types=place,locality,region`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Geocoding failed');
  const data = (await res.json()) as {
    features?: { place_name: string; center: [number, number] }[];
  };
  return (data.features ?? []).map((f) => ({
    label: f.place_name,
    lat: f.center[1],
    lng: f.center[0],
  }));
}

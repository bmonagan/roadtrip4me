import type { StopCategory } from '@roadtrip4me/types';

export const STOP_CATEGORIES: StopCategory[] = [
  'restaurant',
  'attraction',
  'gas_station',
  'lodging',
  'park',
  'viewpoint',
  'campground',
  'museum',
  'shopping',
  'other',
];

export interface ParsedStop {
  name: string;
  description: string;
  category: StopCategory;
  city: string;
  state: string;
  lat: number;
  lng: number;
  reasoning: string;
}

export function parseStops(raw: unknown): ParsedStop[] {
  const stops = Array.isArray((raw as { stops?: unknown })?.stops)
    ? (raw as { stops: unknown[] }).stops
    : [];

  const parsed: ParsedStop[] = [];
  for (const item of stops.slice(0, 10)) {
    const stop = parseStop(item);
    if (stop) parsed.push(stop);
  }
  return parsed;
}

export function parseStop(raw: unknown): ParsedStop | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;

  const name = cleanString(s.name);
  const lat = cleanNumber(s.lat);
  const lng = cleanNumber(s.lng);
  const city = cleanString(s.city) ?? '';
  const state = cleanString(s.state) ?? '';
  if (!name || lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  const category = STOP_CATEGORIES.includes(s.category as StopCategory)
    ? (s.category as StopCategory)
    : 'other';

  return {
    name,
    description: cleanString(s.description) ?? name,
    category,
    city,
    state,
    lat,
    lng,
    reasoning: cleanString(s.reasoning) ?? '',
  };
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

function cleanNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  // null/undefined/objects must not be coerced (Number(null) === 0 would place
  // a stop at (0,0)); only real numbers or numeric strings are accepted.
  return null;
}

import type {
  PaginatedResponse,
  Stop,
  StopWithUserVote,
  Trip,
  TripSummary,
} from '@roadtrip4me/types';

// TEMPORARY: no Auth0 yet, so every request is made as the seeded dev user.
// Remove this once real authentication is wired up.
const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID ?? 'user_alice';
const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': DEV_USER_ID,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body!.message.join(', ')
      : (body?.message ?? `Request failed (${res.status})`);
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function toQueryString(params?: object): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface ListStopsParams {
  page?: number;
  pageSize?: number;
  category?: string;
  city?: string;
}

export interface NearbyStopsParams {
  lat: number;
  lng: number;
  radiusMeters?: number;
  limit?: number;
}

export interface ListTripsParams {
  page?: number;
  pageSize?: number;
}

export const api = {
  trips: {
    list: (params?: ListTripsParams) =>
      request<PaginatedResponse<TripSummary>>(`/trips${toQueryString(params)}`),
    get: (id: string) => request<Trip>(`/trips/${id}`),
  },
  stops: {
    list: (params?: ListStopsParams) =>
      request<PaginatedResponse<Stop>>(`/stops${toQueryString(params)}`),
    nearby: (params: NearbyStopsParams) =>
      request<(Stop & { distanceMeters: number })[]>(`/stops/nearby${toQueryString(params)}`),
    get: (id: string) => request<StopWithUserVote>(`/stops/${id}`),
  },
  votes: {
    cast: (stopId: string, value: 1 | -1) =>
      request<StopWithUserVote>(`/votes/${stopId}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
    remove: (stopId: string) => request<void>(`/votes/${stopId}`, { method: 'DELETE' }),
  },
};

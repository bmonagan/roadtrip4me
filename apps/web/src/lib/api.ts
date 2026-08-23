import type {
  AffiliateCard,
  BillingCancelResponse,
  BillingStatus,
  PaginatedResponse,
  Stop,
  StopRecommendation,
  StopWithUserVote,
  Trip,
  TripSummary,
  User,
} from '@roadtrip4me/types';
import { authConfig, authStore } from '../auth/authStore';

// TEMPORARY dev fallback: when no Auth0 token is present (local dev with auth
// disabled on the API), requests are made as a seeded dev user. The active dev
// user is chosen on the /login page; falls back to the env default. Remove once
// Auth0 is configured.
const DEV_USER_ID_DEFAULT = import.meta.env.VITE_DEV_USER_ID ?? 'user_alice';
const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

function devUserId(): string {
  return authStore.getDevUserId() ?? DEV_USER_ID_DEFAULT;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authStore.getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : { 'x-user-id': devUserId() }),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized();
    }
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

// When an authenticated request comes back 401 the Auth0 token has expired
// (opaque tokens are valid 24h) or been invalidated. Clear the session and
// route the user to the login page. Dev mode (no token) keeps the fallback
// header and should not trigger redirects — a 401 there means an unknown
// dev user, surfaced as a normal error instead.
let redirecting = false;
function handleUnauthorized(): void {
  const hadToken = authStore.getToken();
  authStore.setToken(null);
  authStore.setDevUserId(null);
  if (hadToken && authConfig.configured && !redirecting) {
    redirecting = true;
    window.location.assign(`/login?expired=1`);
  }
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
  q?: string;
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

export interface TripPlace {
  label: string;
  lat: number;
  lng: number;
}

export interface CreateTripInput {
  title: string;
  origin: TripPlace;
  destination: TripPlace;
  status?: Trip['status'];
  vibes?: Trip['vibes'];
  startDate?: string | null;
  endDate?: string | null;
}

export type UpdateTripInput = Partial<CreateTripInput>;

export interface CreateStopInput {
  name: string;
  description?: string;
  category: Stop['category'];
  coordinates: { lat: number; lng: number };
  address: {
    street?: string;
    city: string;
    state: string;
    country?: string;
    postalCode?: string;
  };
}

export type RecommendedStop = StopRecommendation & { city: string; state: string };

export type RecommendationsStatus =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'failed'; message?: string }
  | { status: 'completed'; data: RecommendedStop[] };

export interface RecommendationInput {
  vibes?: Trip['vibes'];
  maxDetourMinutes?: number;
  preferences?: {
    avoidHighways?: boolean;
    preferNationalParks?: boolean;
    foodPreferences?: string[];
  };
}

export const api = {
  users: {
    me: () => request<User>(`/users/me`),
  },
  billing: {
    checkout: () => request<{ url: string }>(`/billing/checkout`, { method: 'POST' }),
    status: () => request<BillingStatus>(`/billing/status`),
    cancel: () => request<BillingCancelResponse>(`/billing/cancel`, { method: 'POST' }),
  },
  trips: {
    list: (params?: ListTripsParams) =>
      request<PaginatedResponse<TripSummary>>(`/trips${toQueryString(params)}`),
    get: (id: string) => request<Trip>(`/trips/${id}`),
    create: (input: CreateTripInput) =>
      request<Trip>('/trips', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: UpdateTripInput) =>
      request<Trip>(`/trips/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    remove: (id: string) => request<void>(`/trips/${id}`, { method: 'DELETE' }),
    addStop: (id: string, stopId: string) =>
      request<Trip>(`/trips/${id}/stops`, { method: 'POST', body: JSON.stringify({ stopId }) }),
    removeStop: (id: string, stopId: string) =>
      request<Trip>(`/trips/${id}/stops/${stopId}`, { method: 'DELETE' }),
    addWaypoint: (id: string, input: TripPlace) =>
      request<Trip>(`/trips/${id}/waypoints`, { method: 'POST', body: JSON.stringify(input) }),
    removeWaypoint: (id: string, waypointId: string) =>
      request<Trip>(`/trips/${id}/waypoints/${waypointId}`, { method: 'DELETE' }),
    addCollaborator: (id: string, email: string) =>
      request<Trip>(`/trips/${id}/collaborators`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    removeCollaborator: (id: string, collaboratorUserId: string) =>
      request<Trip>(`/trips/${id}/collaborators/${collaboratorUserId}`, { method: 'DELETE' }),
    accommodations: (id: string) => request<AffiliateCard[]>(`/trips/${id}/accommodations`),
    recommendations: {
      enqueue: (id: string, input: RecommendationInput) =>
        request<{ jobId: string; status: string }>(`/trips/${id}/recommendations`, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      status: (id: string) => request<RecommendationsStatus>(`/trips/${id}/recommendations`),
    },
  },
  stops: {
    list: (params?: ListStopsParams) =>
      request<PaginatedResponse<Stop>>(`/stops${toQueryString(params)}`),
    nearby: (params: NearbyStopsParams) =>
      request<(Stop & { distanceMeters: number })[]>(`/stops/nearby${toQueryString(params)}`),
    get: (id: string) => request<StopWithUserVote>(`/stops/${id}`),
    create: (input: CreateStopInput) =>
      request<Stop>('/stops', { method: 'POST', body: JSON.stringify(input) }),
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

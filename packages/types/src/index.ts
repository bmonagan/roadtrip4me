// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  isPremium: boolean;
}

// ─── Geography ───────────────────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  street: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
}

// ─── Stop ────────────────────────────────────────────────────────────────────

export type StopCategory =
  | 'restaurant'
  | 'attraction'
  | 'gas_station'
  | 'lodging'
  | 'park'
  | 'viewpoint'
  | 'campground'
  | 'museum'
  | 'shopping'
  | 'other';

export interface Stop {
  id: string;
  name: string;
  description: string | null;
  coordinates: Coordinates;
  address: Address;
  category: StopCategory;
  imageUrl: string | null;
  externalId: string | null; // Google Place ID, Yelp ID, etc.
  score: number; // Aggregated vote score
  voteCount: number;
  submittedByUserId: string | null;
  createdAt: string;
}

export interface StopWithUserVote extends Stop {
  userVote: 1 | -1 | null; // Current user's vote, if authenticated
}

// ─── Vote ────────────────────────────────────────────────────────────────────

export interface Vote {
  id: string;
  userId: string;
  stopId: string;
  value: 1 | -1;
  createdAt: string;
}

// ─── Trip ────────────────────────────────────────────────────────────────────

export type TripStatus = 'draft' | 'planned' | 'in_progress' | 'completed';

export type TripVibe = 'scenic' | 'foodie' | 'adventure' | 'historic' | 'relaxed' | 'family';

export interface TripWaypoint {
  id: string;
  order: number;
  coordinates: Coordinates;
  label: string;
  stopId: string | null;  // null = user-defined waypoint, not a Stop record
}

export interface Trip {
  id: string;
  userId: string;
  title: string;
  status: TripStatus;
  vibes: TripVibe[];
  origin: Coordinates & { label: string };
  destination: Coordinates & { label: string };
  waypoints: TripWaypoint[];
  stops: Stop[];
  startDate: string | null;
  endDate: string | null;
  totalDistanceMeters: number | null;
  totalDurationSeconds: number | null;
  encodedPolyline: string | null; // Encoded route polyline (google encoding)
  createdAt: string;
  updatedAt: string;
}

export interface TripSummary {
  id: string;
  title: string;
  status: TripStatus;
  origin: string;
  destination: string;
  stopCount: number;
  startDate: string | null;
  createdAt: string;
}

// ─── AI Recommendations ──────────────────────────────────────────────────────

export interface StopRecommendation {
  name: string;
  description: string;
  coordinates: Coordinates;
  category: StopCategory;
  reasoning: string; // Why AI recommended this stop
  distanceFromRouteMeters: number;
}

export interface RecommendationRequest {
  tripId: string;
  vibes: TripVibe[];
  maxDetourMinutes: number;
  preferences: {
    avoidHighways: boolean;
    preferNationalParks: boolean;
    foodPreferences: string[];
  };
}

// ─── Affiliate ───────────────────────────────────────────────────────────────

export interface AffiliateCard {
  provider: 'booking_com' | 'expedia';
  name: string;
  imageUrl: string;
  pricePerNight: number;
  currency: string;
  rating: number;
  reviewCount: number;
  affiliateUrl: string;
  coordinates: Coordinates;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
}

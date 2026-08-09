import { Injectable, Logger } from '@nestjs/common';
import { encode } from '@googlemaps/polyline-codec';
import type { GeoPoint } from '../common/geo';

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const MAX_INTERMEDIATES = 25;

export interface RouteResult {
  /** Standard (google) polyline encoding of the route, decodable by @googlemaps/polyline-codec. */
  encodedPolyline: string;
  distanceMeters: number;
  durationSeconds: number;
}

interface ComputeRoutesResponse {
  routes?: {
    distanceMeters?: number;
    duration?: string;
    polyline?: { geoJsonLinestring?: { coordinates?: [number, number][] } };
  }[];
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);

  /** Returns a driving route, or null when no drivable route exists. */
  async getRoute(
    origin: GeoPoint,
    destination: GeoPoint,
    intermediates: GeoPoint[]
  ): Promise<RouteResult | null> {
    const apiKey = process.env['GOOGLE_MAPS_API_KEY'];
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }

    const res = await fetch(ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // geoJsonLinestring gives plain coordinates — no polyline decode needed.
        'X-Goog-FieldMask':
          'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring',
      },
      body: JSON.stringify({
        origin: this.waypoint(origin),
        destination: this.waypoint(destination),
        ...(intermediates.length > 0 && {
          intermediates: intermediates.slice(0, MAX_INTERMEDIATES).map(this.waypoint),
        }),
        travelMode: 'DRIVE',
        polylineEncoding: 'GEO_JSON_LINESTRING',
      }),
    });

    if (!res.ok) {
      throw new Error(`Routes API error ${res.status}: ${(await res.text()).slice(0, 500)}`);
    }

    const data = (await res.json()) as ComputeRoutesResponse;
    const route = data.routes?.[0];
    const coordinates = route?.polyline?.geoJsonLinestring?.coordinates;

    if (!route || !coordinates || coordinates.length < 2) {
      return null;
    }

    // GeoJSON uses [lng, lat]; re-encode as a standard polyline for storage and
    // rendering, which both the API and the web app can decode.
    const encodedPolyline = encode(coordinates.map(([lng, lat]) => [lat, lng] as [number, number]));

    return {
      encodedPolyline,
      distanceMeters: route.distanceMeters ?? 0,
      durationSeconds: parseDurationSeconds(route.duration),
    };
  }

  private waypoint(point: GeoPoint) {
    return {
      location: { latLng: { latitude: point.lat, longitude: point.lng } },
    };
  }
}

function parseDurationSeconds(duration: string | undefined): number {
  if (!duration) return 0;
  const seconds = Number.parseFloat(duration);
  return Number.isFinite(seconds) ? Math.round(seconds) : 0;
}

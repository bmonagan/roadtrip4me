import { Injectable } from '@nestjs/common';
import { encode } from '@googlemaps/polyline-codec';
import { haversineMeters, type GeoPoint } from '../common/geo';
import { GoogleMapsService, type RouteResult } from './google-maps.service';

// Average driving speed used to turn a demo straight-line distance into an
// estimated duration. Deliberately modest — this is a mock, not a guess at
// real traffic.
const DEMO_AVG_SPEED_MPS = 22; // ~80 km/h

/**
 * Demo replacement for {@link GoogleMapsService}. Builds the route as a
 * straight line through origin → intermediates → destination, so trip maps
 * render and distances are non-zero without any Google Routes/Places calls.
 */
@Injectable()
export class DemoGoogleMapsService extends GoogleMapsService {
  override async getRoute(
    origin: GeoPoint,
    destination: GeoPoint,
    intermediates: GeoPoint[]
  ): Promise<RouteResult | null> {
    const points = [origin, ...intermediates, destination];
    if (points.length < 2) return null;

    const encodedPolyline = encode(points.map((p) => [p.lat, p.lng] as [number, number]));

    let distanceMeters = 0;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      if (a && b) distanceMeters += haversineMeters(a, b);
    }

    return {
      encodedPolyline,
      distanceMeters: Math.round(distanceMeters),
      durationSeconds: Math.round(distanceMeters / DEMO_AVG_SPEED_MPS),
    };
  }

  // No Places API in demo mode; callers fall back to the approximate
  // coordinates they already have.
  override async searchPlace(): Promise<GeoPoint | null> {
    return null;
  }
}

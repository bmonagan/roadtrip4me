export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Great-circle distance between two points in meters (haversine). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Equirectangular projection onto a local plane (accurate enough for the
// short distances involved in "how far off the route is this point").
function toLocalXY(point: GeoPoint, ref: GeoPoint): { x: number; y: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const refLat = toRad(ref.lat);
  return {
    x: (toRad(point.lng) - toRad(ref.lng)) * Math.cos(refLat) * EARTH_RADIUS_M,
    y: (toRad(point.lat) - toRad(ref.lat)) * EARTH_RADIUS_M,
  };
}

function distanceToSegmentMeters(
  point: GeoPoint,
  segmentStart: GeoPoint,
  segmentEnd: GeoPoint
): number {
  const p = toLocalXY(point, segmentStart);
  const a = { x: 0, y: 0 };
  const b = toLocalXY(segmentEnd, segmentStart);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;

  // Degenerate segment (start === end): just the distance to the start point.
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  // Project p onto the line, clamped to the segment.
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Shortest distance in meters from a point to a polyline route. The route is
 * treated as the chain of straight segments between consecutive points.
 */
export function distanceToRouteMeters(point: GeoPoint, route: GeoPoint[]): number {
  if (route.length < 2) {
    return route.length === 1 && route[0] ? haversineMeters(point, route[0]) : Infinity;
  }

  let min = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (!a || !b) continue;
    const d = distanceToSegmentMeters(point, a, b);
    if (d < min) min = d;
  }
  return min;
}

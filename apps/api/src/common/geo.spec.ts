import { describe, expect, it } from 'vitest';
import { distanceToRouteMeters, haversineMeters } from './geo';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(0);
  });

  it('approximates a known distance (Chicago -> New York ~1,150 km)', () => {
    const d = haversineMeters(
      { lat: 41.8781, lng: -87.6298 },
      { lat: 40.7128, lng: -74.006 }
    );
    expect(d).toBeGreaterThan(1_100_000);
    expect(d).toBeLessThan(1_200_000);
  });

  it('is symmetric', () => {
    const a = { lat: 35, lng: -100 };
    const b = { lat: 40, lng: -110 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 0);
  });
});

describe('distanceToRouteMeters', () => {
  it('is ~0 for a point on the route', () => {
    const route = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
    ];
    expect(distanceToRouteMeters({ lat: 0, lng: 0.5 }, route)).toBeLessThan(100);
  });

  it('measures perpendicular distance from the segment', () => {
    const route = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 1 },
    ];
    // ~55 km north of the midpoint at 0.5° latitude (1° lat ≈ 111 km).
    const d = distanceToRouteMeters({ lat: 0.5, lng: 0.5 }, route);
    expect(d).toBeGreaterThan(50_000);
    expect(d).toBeLessThan(60_000);
  });

  it('returns Infinity for an empty route', () => {
    expect(distanceToRouteMeters({ lat: 0, lng: 0 }, [])).toBe(Infinity);
  });

  it('returns the distance to the nearest waypoint for a single-point route', () => {
    expect(distanceToRouteMeters({ lat: 0, lng: 0 }, [{ lat: 0, lng: 1 }])).toBeGreaterThan(100_000);
  });
});

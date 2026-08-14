import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { decode } from '@googlemaps/polyline-codec';
import type { Trip } from '@roadtrip4me/types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

// Real route from Google when stored; otherwise fall back to a straight line
// through origin → stops → destination.
function routeCoordinates(trip: Trip): [number, number][] {
  if (trip.encodedPolyline) {
    try {
      const decoded = decode(trip.encodedPolyline);
      if (decoded.length >= 2) {
        return decoded.map(([lat, lng]) => [lng, lat] as [number, number]);
      }
    } catch {
      // malformed polyline — fall through to the straight-line route
    }
  }
  return [
    [trip.origin.lng, trip.origin.lat],
    ...trip.stops.map((s) => [s.coordinates.lng, s.coordinates.lat] as [number, number]),
    [trip.destination.lng, trip.destination.lat],
  ];
}

export default function TripMap({ trip }: { trip: Trip }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [trip.destination.lng, trip.destination.lat],
      zoom: 4,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      const coords = routeCoordinates(trip);

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#3b82f6', 'line-width': 4 },
      });

      new mapboxgl.Marker({ color: '#10b981' })
        .setLngLat([trip.origin.lng, trip.origin.lat])
        .setPopup(new mapboxgl.Popup({ anchor: 'center' }).setText(`Start: ${trip.origin.label}`))
        .addTo(map);
      new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([trip.destination.lng, trip.destination.lat])
        .setPopup(new mapboxgl.Popup({ anchor: 'center' }).setText(`End: ${trip.destination.label}`))
        .addTo(map);
      trip.stops.forEach((stop) => {
        new mapboxgl.Marker({ color: '#f97316' })
          .setLngLat([stop.coordinates.lng, stop.coordinates.lat])
          .setPopup(new mapboxgl.Popup({ anchor: 'center' }).setText(stop.name))
          .addTo(map);
      });

      const bounds = coords.reduce(
        (b, [lng, lat]) => b.extend([lng, lat]),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 60 });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [trip]);

  if (!MAPBOX_TOKEN) {
    return <p className="muted">Add VITE_MAPBOX_TOKEN to apps/web/.env to see the map.</p>;
  }

  return <div ref={containerRef} className="trip-map" aria-label="Trip route map" />;
}

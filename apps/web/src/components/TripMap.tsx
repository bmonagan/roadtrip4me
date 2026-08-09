import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { Trip } from '@roadtrip4me/types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
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
      const routeCoordinates: [number, number][] = [
        [trip.origin.lng, trip.origin.lat],
        ...trip.stops.map((s) => [s.coordinates.lng, s.coordinates.lat] as [number, number]),
        [trip.destination.lng, trip.destination.lat],
      ];

      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: routeCoordinates },
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
        .setPopup(new mapboxgl.Popup().setText(`Start: ${trip.origin.label}`))
        .addTo(map);
      new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([trip.destination.lng, trip.destination.lat])
        .setPopup(new mapboxgl.Popup().setText(`End: ${trip.destination.label}`))
        .addTo(map);
      trip.stops.forEach((stop) => {
        new mapboxgl.Marker({ color: '#f97316' })
          .setLngLat([stop.coordinates.lng, stop.coordinates.lat])
          .setPopup(new mapboxgl.Popup().setText(stop.name))
          .addTo(map);
      });

      const bounds = routeCoordinates.reduce(
        (b, [lng, lat]) => b.extend([lng, lat]),
        new mapboxgl.LngLatBounds(routeCoordinates[0], routeCoordinates[0])
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

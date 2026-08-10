import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { TripPlace } from '../lib/api';
import PlaceSearch from '../components/PlaceSearch';

export default function HomePage() {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<TripPlace | null>(null);
  const [destination, setDestination] = useState<TripPlace | null>(null);

  const planTrip = () => {
    const params = new URLSearchParams();
    if (origin) {
      params.set('from', origin.label);
      params.set('fromLat', String(origin.lat));
      params.set('fromLng', String(origin.lng));
    }
    if (destination) {
      params.set('to', destination.label);
      params.set('toLat', String(destination.lat));
      params.set('toLng', String(destination.lng));
    }
    navigate(`/trips/new?${params.toString()}`);
  };

  const scrollToSearch = () =>
    searchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="landing-hero">
      <div className="landing-hero-inner">
        <div>
          <span className="landing-badge">✨ New: AI Planner</span>
          <h1 className="landing-title">
            The Open Road,
            <br />
            <span className="accent">Reimagined by AI.</span>
          </h1>
          <p className="landing-sub">
            Skip the spreadsheets. Tell us where you want to go, and let our AI
            plan the perfect adventure — finding the best scenic detours along
            the way.
          </p>
          <div className="landing-cta">
            <button type="button" className="btn primary" onClick={scrollToSearch}>
              Start Your Journey →
            </button>
            <Link to="/stops" className="btn">
              Browse community stops
            </Link>
          </div>
        </div>

        <div ref={searchRef} className="landing-search">
          <h2>Plan your trip</h2>
          <PlaceSearch label="Start" value={origin} onSelect={setOrigin} />
          <PlaceSearch label="Destination" value={destination} onSelect={setDestination} />
          <button
            type="button"
            className="btn primary landing-search-btn"
            onClick={planTrip}
            disabled={!origin || !destination}
          >
            Plan my trip →
          </button>
        </div>
      </div>
    </div>
  );
}

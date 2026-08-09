import { useEffect, useRef, useState } from 'react';
import type { GeocodeResult } from '../lib/geocode';
import { geocode } from '../lib/geocode';

interface PlaceSearchProps {
  label: string;
  value?: GeocodeResult | null;
  onSelect: (place: GeocodeResult) => void;
}

export default function PlaceSearch({ label, value, onSelect }: PlaceSearchProps) {
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (text: string) => {
    setQuery(text);
    setOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        setResults(await geocode(text));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
        setResults([]);
      }
    }, 350);
  };

  const select = (place: GeocodeResult) => {
    setQuery(place.label);
    setResults([]);
    setOpen(false);
    onSelect(place);
  };

  return (
    <label className="place-search">
      <span>{label}</span>
      <input
        type="text"
        placeholder="Search for a city or place…"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {error && <small className="error">{error}</small>}
      {open && results.length > 0 && (
        <ul className="place-results">
          {results.map((place, i) => (
            <li key={`${place.label}-${i}`}>
              <button type="button" onMouseDown={() => select(place)}>
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

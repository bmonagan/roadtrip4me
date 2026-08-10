import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Trip, TripVibe } from '@roadtrip4me/types';
import { api, type TripPlace } from '../lib/api';
import PlaceSearch from '../components/PlaceSearch';

const VIBES: TripVibe[] = ['scenic', 'foodie', 'adventure', 'historic', 'relaxed', 'family'];
const STATUSES: Trip['status'][] = ['draft', 'planned', 'in_progress', 'completed'];

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function placeFromParams(params: URLSearchParams, prefix: string): TripPlace | null {
  const label = params.get(prefix);
  const lat = params.get(`${prefix}Lat`);
  const lng = params.get(`${prefix}Lng`);
  if (!label || !lat || !lng) return null;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
  return { label, lat: latNum, lng: lngNum };
}

export default function TripFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => api.trips.get(id!),
    enabled: isEdit,
  });

  // Prefill origin/destination from the landing-page search (?from&to...).
  const [title, setTitle] = useState('');
  const [origin, setOrigin] = useState<TripPlace | null>(() =>
    placeFromParams(searchParams, 'from')
  );
  const [destination, setDestination] = useState<TripPlace | null>(() =>
    placeFromParams(searchParams, 'to')
  );
  const [vibes, setVibes] = useState<TripVibe[]>([]);
  const [status, setStatus] = useState<Trip['status']>('draft');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- seed the form from the fetched trip once */
  useEffect(() => {
    if (!trip) return;
    setTitle(trip.title);
    setOrigin({ label: trip.origin.label, lat: trip.origin.lat, lng: trip.origin.lng });
    setDestination({
      label: trip.destination.label,
      lat: trip.destination.lat,
      lng: trip.destination.lng,
    });
    setVibes(trip.vibes);
    setStatus(trip.status);
    setStartDate(toDateInputValue(trip.startDate));
    setEndDate(toDateInputValue(trip.endDate));
  }, [trip]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? api.trips.update(id!, {
            title: title.trim(),
            origin: origin!,
            destination: destination!,
            vibes,
            status,
            startDate: startDate || null,
            endDate: endDate || null,
          })
        : api.trips.create({
            title: title.trim(),
            origin: origin!,
            destination: destination!,
            vibes,
            status,
            startDate: startDate || null,
            endDate: endDate || null,
          }),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      navigate(`/trips/${saved.id}`);
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const toggleVibe = (vibe: TripVibe) => {
    setVibes((prev) => (prev.includes(vibe) ? prev.filter((v) => v !== vibe) : [...prev, vibe]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) return setFormError('Title is required');
    if (!origin) return setFormError('Pick a start location');
    if (!destination) return setFormError('Pick an end location');
    mutation.mutate();
  };

  if (isEdit && isLoading) return <p className="muted">Loading trip…</p>;

  return (
    <div className="page form-page">
      <Link to={isEdit ? `/trips/${id}` : '/trips'} className="back-link">
        ← Back
      </Link>
      <h1>{isEdit ? 'Edit Trip' : 'New Trip'}</h1>

      <form onSubmit={handleSubmit}>
        <label>
          <span>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Route 66 Classic"
            maxLength={120}
          />
        </label>

        <div className="form-row">
          <PlaceSearch label="Start" value={origin} onSelect={setOrigin} />
          <PlaceSearch label="Destination" value={destination} onSelect={setDestination} />
        </div>

        <fieldset className="vibe-fieldset">
          <legend>Vibes</legend>
          <div className="vibe-chips">
            {VIBES.map((vibe) => (
              <button
                key={vibe}
                type="button"
                className={`chip${vibes.includes(vibe) ? ' chip-active' : ''}`}
                onClick={() => toggleVibe(vibe)}
              >
                {vibe}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="form-row">
          <label>
            <span>Start date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            <span>End date</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as Trip['status'])}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {formError && <p className="error">{formError}</p>}
        {mutation.isError && <p className="error">{(mutation.error as Error).message}</p>}

        <button type="submit" className="primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create trip'}
        </button>
      </form>
    </div>
  );
}

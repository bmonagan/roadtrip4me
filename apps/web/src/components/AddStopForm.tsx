import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CreateStopInput } from '../lib/api';
import { useToast } from '../lib/useToast';
import PlaceSearch from './PlaceSearch';
import type { GeocodeResult } from '../lib/geocode';

const CATEGORIES = [
  'restaurant',
  'attraction',
  'gas_station',
  'lodging',
  'park',
  'viewpoint',
  'campground',
  'museum',
  'shopping',
  'other',
] as const;

export default function AddStopForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<CreateStopInput['category']>('other');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState<GeocodeResult | null>(null);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () =>
      api.stops.create({
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        coordinates: { lat: place!.lat, lng: place!.lng },
        address: { city: city.trim(), state: state.trim() },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stops'] });
      toast({ message: 'Stop added', type: 'success' });
      onDone();
    },
    onError: (e) => toast({ message: (e as Error).message, type: 'error' }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!place) errs.place = 'Pick a location';
    if (!city.trim()) errs.city = 'City is required';
    if (!state.trim()) errs.state = 'State is required';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="add-stop-form">
      <div className="form-row">
        <label>
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: '' }));
            }}
            placeholder="e.g. Hidden Falls Trail"
            maxLength={200}
            className={errors.name ? 'input-error' : ''}
          />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as CreateStopInput['category'])}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PlaceSearch label="Location" value={place} onSelect={setPlace} error={errors.place || ''} />
      {errors.place && <small className="field-error">{errors.place}</small>}

      <div className="form-row">
        <label>
          <span>City</span>
          <input
            type="text"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setErrors((p) => ({ ...p, city: '' }));
            }}
            maxLength={100}
            className={errors.city ? 'input-error' : ''}
          />
          {errors.city && <small className="field-error">{errors.city}</small>}
        </label>
        <label>
          <span>State</span>
          <input
            type="text"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setErrors((p) => ({ ...p, state: '' }));
            }}
            maxLength={100}
            className={errors.state ? 'input-error' : ''}
          />
          {errors.state && <small className="field-error">{errors.state}</small>}
        </label>
      </div>

      <label>
        <span>Description (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </label>

      <button type="submit" className="btn primary" disabled={mutation.isPending}>
        {mutation.isPending ? 'Adding…' : 'Add stop'}
      </button>
    </form>
  );
}

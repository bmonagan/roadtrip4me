import { describe, expect, it } from 'vitest';
import { mapStop } from './mappers/stop.mapper';

describe('mapStop', () => {
  it('maps a prisma row to the shared Stop shape', () => {
    const row = {
      id: 'stop_1',
      name: 'Cadillac Ranch',
      description: null,
      category: 'attraction' as const,
      imageUrl: null,
      lat: 35.1872,
      lng: -101.9872,
      street: null,
      city: 'Amarillo',
      state: 'TX',
      country: 'US',
      postalCode: null,
      externalId: null,
      score: 5,
      voteCount: 3,
      submittedByUserId: null,
      createdAt: new Date('2024-01-02T03:04:05.000Z'),
    };

    const out = mapStop(row);

    expect(out.id).toBe('stop_1');
    expect(out.coordinates).toEqual({ lat: 35.1872, lng: -101.9872 });
    expect(out.address).toEqual({
      street: null,
      city: 'Amarillo',
      state: 'TX',
      country: 'US',
      postalCode: null,
    });
    expect(out.score).toBe(5);
    expect(out.voteCount).toBe(3);
    expect(out.createdAt).toBe('2024-01-02T03:04:05.000Z');
  });
});

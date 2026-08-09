import { describe, expect, it } from 'vitest';
import { parseStops } from './parse';

describe('parseStops', () => {
  it('parses valid stops and coerces fields', () => {
    const raw = {
      stops: [
        {
          name: '  Blue Hole  ',
          description: 'Crystal clear turquoise water.',
          category: 'viewpoint',
          city: 'Santa Rosa',
          state: 'NM',
          lat: 34.8706,
          lng: -104.6078,
          reasoning: 'Great for a photo stop.',
        },
      ],
    };

    const stops = parseStops(raw);
    expect(stops).toHaveLength(1);
    expect(stops[0]!.name).toBe('Blue Hole');
    expect(stops[0]!.category).toBe('viewpoint');
    expect(stops[0]!.lat).toBe(34.8706);
  });

  it('defaults unknown categories to "other"', () => {
    const stops = parseStops({
      stops: [
        { name: 'X', category: 'beach', lat: 1, lng: 1 },
      ],
    });
    expect(stops[0]!.category).toBe('other');
  });

  it('drops stops with invalid coordinates', () => {
    const stops = parseStops({
      stops: [
        { name: 'ok', lat: 10, lng: 20 },
        { name: 'bad lat', lat: 999, lng: 20 },
        { name: 'missing coords' },
      ],
    });
    expect(stops).toHaveLength(1);
    expect(stops[0]!.name).toBe('ok');
  });

  it('returns empty for non-object input', () => {
    expect(parseStops(null)).toEqual([]);
    expect(parseStops({})).toEqual([]);
    expect(parseStops({ stops: 'nope' })).toEqual([]);
  });

  it('limits to 10 stops', () => {
    const stops = Array.from({ length: 15 }, (_, i) => ({
      name: `stop ${i}`,
      lat: i,
      lng: i,
    }));
    expect(parseStops({ stops })).toHaveLength(10);
  });

  it('uses the name as the description fallback', () => {
    const stops = parseStops({ stops: [{ name: 'Solo', lat: 1, lng: 2 }] });
    expect(stops[0]!.description).toBe('Solo');
  });
});

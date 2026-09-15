import { describe, expect, it } from 'vitest';
import { TtlCache } from './ttl-cache';

function makeCache(overrides: { ttlMs?: number; maxEntries?: number; now?: () => number } = {}) {
  let clock = 0;
  const cache = new TtlCache<string>({
    ttlMs: overrides.ttlMs ?? 1000,
    maxEntries: overrides.maxEntries,
    now: overrides.now ?? (() => clock),
  });
  return { cache, tick: (ms: number) => (clock += ms) };
}

describe('TtlCache', () => {
  it('returns a value before it expires and undefined after', () => {
    const { cache, tick } = makeCache({ ttlMs: 1000 });
    cache.set('a', 'value');
    expect(cache.get('a')).toBe('value');

    tick(999);
    expect(cache.get('a')).toBe('value');

    tick(1);
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts the least-recently-used entry past maxEntries', () => {
    const { cache } = makeCache({ ttlMs: 10_000, maxEntries: 2 });
    cache.set('a', '1');
    cache.set('b', '2');
    // Touch 'a' so 'b' becomes the LRU entry.
    expect(cache.get('a')).toBe('1');
    cache.set('c', '3');

    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
  });

  it('drops expired entries when making room for new ones', () => {
    const { cache, tick } = makeCache({ ttlMs: 100, maxEntries: 2 });
    cache.set('a', '1');
    cache.set('b', '2');
    tick(200);
    cache.set('c', '3');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('3');
  });

  it('clear() empties the cache', () => {
    const { cache } = makeCache();
    cache.set('a', '1');
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});

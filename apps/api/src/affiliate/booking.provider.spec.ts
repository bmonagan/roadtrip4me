import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingProvider, mapBookingHotels } from './booking.provider';
import type { AccommodationQuery } from './query';

const query: AccommodationQuery = { destination: 'Chicago, IL', lat: 41.88, lng: -87.63 };

function configureApi() {
  process.env['BOOKING_COM_AFFILIATE_ID'] = 'bookaid';
  process.env['BOOKING_COM_API_ENABLED'] = 'true';
  process.env['BOOKING_COM_API_URL'] = 'https://api.booking.test/search';
  process.env['BOOKING_COM_API_TOKEN'] = 'token';
}

function clearEnv() {
  for (const key of [
    'BOOKING_COM_AFFILIATE_ID',
    'BOOKING_COM_SID',
    'BOOKING_COM_API_ENABLED',
    'BOOKING_COM_API_URL',
    'BOOKING_COM_API_TOKEN',
  ]) {
    delete process.env[key];
  }
}

describe('BookingProvider deeplinks', () => {
  afterEach(clearEnv);

  it('builds an affiliate-tagged search link', () => {
    process.env['BOOKING_COM_AFFILIATE_ID'] = 'bookaid';
    process.env['BOOKING_COM_SID'] = 'campaign1';
    const card = new BookingProvider().deeplink(query)!;
    expect(card.provider).toBe('booking_com');
    expect(card.affiliateUrl).toContain('aid=bookaid');
    expect(card.affiliateUrl).toContain('sid=campaign1');
    expect(card.affiliateUrl).toContain('ss=Chicago%2C+IL');
    expect(card.pricePerNight).toBeNull();
    expect(card.coordinates).toEqual({ lat: 41.88, lng: -87.63 });
  });

  it('returns null without an affiliate id', () => {
    expect(new BookingProvider().deeplink(query)).toBeNull();
  });
});

describe('BookingProvider live API', () => {
  afterEach(() => {
    clearEnv();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('falls back to the deeplink when the API is not enabled', async () => {
    process.env['BOOKING_COM_AFFILIATE_ID'] = 'bookaid';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new BookingProvider();

    const cards = await provider.cards(query);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(cards).toHaveLength(1);
    expect(cards[0]!.provider).toBe('booking_com');
    expect(cards[0]!.pricePerNight).toBeNull();
  });

  it('returns live cards and caches them across calls', async () => {
    configureApi();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: [
          {
            hotel_name: 'The Loop Hotel',
            price: 199,
            currency_code: 'USD',
            review_score: 8.7,
            review_nr: 1234,
            photo_urls: [{ url: 'https://img.test/a.jpg' }],
            url: 'https://www.booking.com/hotel/a.html',
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new BookingProvider();

    const first = await provider.cards(query);
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({
      name: 'The Loop Hotel',
      pricePerNight: 199,
      currency: 'USD',
      rating: 8.7,
      reviewCount: 1234,
      imageUrl: 'https://img.test/a.jpg',
      affiliateUrl: 'https://www.booking.com/hotel/a.html',
    });

    const second = await provider.cards(query);
    expect(second).toEqual(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to the deeplink when the API request fails', async () => {
    configureApi();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' }));
    const provider = new BookingProvider();

    const cards = await provider.cards(query);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.affiliateUrl).toContain('aid=bookaid');
  });

  it('collapses concurrent misses into a single API call', async () => {
    configureApi();
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hotels: [{ name: 'Hotel X', url: 'https://www.booking.com/x' }] }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new BookingProvider();

    const [a, b] = await Promise.all([provider.search(query), provider.search(query)]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});

describe('mapBookingHotels', () => {
  it('maps common field names and falls back to the deeplink URL', () => {
    const cards = mapBookingHotels(
      { data: [{ hotelName: 'Hotel Y', min_total_price: '250.5', currency: 'EUR' }] },
      query,
      'https://www.booking.com/searchresults.html?aid=bookaid'
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      name: 'Hotel Y',
      pricePerNight: 250.5,
      currency: 'EUR',
      affiliateUrl: 'https://www.booking.com/searchresults.html?aid=bookaid',
    });
  });

  it('skips rows without a name and caps the result count', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      hotel_name: `Hotel ${i}`,
      url: `https://www.booking.com/${i}`,
    }));
    const cards = mapBookingHotels({ result: [{ foo: 'bar' }, ...rows] }, query, '');
    expect(cards.length).toBeLessThanOrEqual(6);
    expect(cards.every((c) => c.name.startsWith('Hotel'))).toBe(true);
  });

  it('returns nothing for an unrecognized payload', () => {
    expect(mapBookingHotels({ unexpected: true }, query, '')).toEqual([]);
    expect(mapBookingHotels(null, query, '')).toEqual([]);
  });
});

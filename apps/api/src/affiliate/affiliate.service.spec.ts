import { afterEach, describe, expect, it, vi } from 'vitest';
import { AffiliateService } from './affiliate.service';

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    trip: { findFirst: vi.fn() },
    ...overrides,
  };
  const service = new AffiliateService(prisma as never);
  return { service, prisma };
}

function makeTrip(tripStops: { stop: { name: string; city: string; state: string; lat: number; lng: number } }[]) {
  return { id: 't1', userId: 'u1', tripStops };
}

describe('AffiliateService.getAccommodations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['BOOKING_COM_AFFILIATE_ID'];
    delete process.env['EXPEDIA_AFFILIATE_ID'];
  });

  it('returns one card per provider per destination city (dedupes repeat cities)', async () => {
    process.env['BOOKING_COM_AFFILIATE_ID'] = '123';
    process.env['EXPEDIA_AFFILIATE_ID'] = '456';
    const { service, prisma } = makeService();
    prisma.trip.findFirst.mockResolvedValue(
      makeTrip([
        { stop: { name: 'Stop A', city: 'Chicago', state: 'IL', lat: 41.8, lng: -87.6 } },
        { stop: { name: 'Stop B', city: 'Chicago', state: 'IL', lat: 41.9, lng: -87.7 } },
        { stop: { name: 'Stop C', city: 'Springfield', state: 'IL', lat: 39.8, lng: -89.6 } },
      ])
    );

    const cards = await service.getAccommodations('u1', 't1');
    // 2 cities × 2 providers = 4 cards
    expect(cards).toHaveLength(4);
    const cities = cards.map((c) => c.name);
    expect(cities.filter((n) => n === 'Hotels in Chicago')).toHaveLength(2); // booking + expedia
    expect(cities.filter((n) => n === 'Hotels in Springfield')).toHaveLength(2);
  });

  it('includes the affiliate id in Booking.com and Expedia links', async () => {
    process.env['BOOKING_COM_AFFILIATE_ID'] = 'bookaid';
    process.env['EXPEDIA_AFFILIATE_ID'] = 'expaid';
    const { service, prisma } = makeService();
    prisma.trip.findFirst.mockResolvedValue(
      makeTrip([
        { stop: { name: 'Stop A', city: 'Chicago', state: 'IL', lat: 41.8, lng: -87.6 } },
      ])
    );

    const cards = await service.getAccommodations('u1', 't1');
    const booking = cards.find((c) => c.provider === 'booking_com')!;
    const expedia = cards.find((c) => c.provider === 'expedia')!;

    expect(booking.affiliateUrl).toContain('aid=bookaid');
    expect(booking.affiliateUrl).toContain('ss=Chicago%2C+IL');
    expect(expedia.affiliateUrl).toContain('affcid=expaid');
    expect(expedia.affiliateUrl).toContain('destination=Chicago%2C+IL');
  });

  it('omits a provider when its affiliate id is not configured', async () => {
    process.env['EXPEDIA_AFFILIATE_ID'] = 'expaid';
    const { service, prisma } = makeService();
    prisma.trip.findFirst.mockResolvedValue(
      makeTrip([
        { stop: { name: 'Stop A', city: 'Chicago', state: 'IL', lat: 41.8, lng: -87.6 } },
      ])
    );

    const cards = await service.getAccommodations('u1', 't1');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.provider).toBe('expedia');
  });

  it('returns no cards when no affiliate ids are configured', async () => {
    const { service, prisma } = makeService();
    prisma.trip.findFirst.mockResolvedValue(
      makeTrip([
        { stop: { name: 'Stop A', city: 'Chicago', state: 'IL', lat: 41.8, lng: -87.6 } },
      ])
    );

    const cards = await service.getAccommodations('u1', 't1');
    expect(cards).toHaveLength(0);
  });
});

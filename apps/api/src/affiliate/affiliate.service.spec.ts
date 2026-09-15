import { afterEach, describe, expect, it, vi } from 'vitest';
import { AffiliateService } from './affiliate.service';
import { BookingProvider } from './booking.provider';
import { ExpediaProvider } from './expedia.provider';

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    trip: { findFirst: vi.fn() },
    ...overrides,
  };
  const service = new AffiliateService(prisma as never, new BookingProvider(), new ExpediaProvider());
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
    delete process.env['BOOKING_COM_API_ENABLED'];
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
    expect(cities.filter((n) => n === 'Hotels in Chicago, IL')).toHaveLength(2); // booking + expedia
    expect(cities.filter((n) => n === 'Hotels in Springfield, IL')).toHaveLength(2);
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

  it('throws NotFoundException for a trip the user cannot see', async () => {
    const { service, prisma } = makeService();
    prisma.trip.findFirst.mockResolvedValue(null);
    await expect(service.getAccommodations('u1', 'missing')).rejects.toThrow('not found');
  });
});

describe('AffiliateService.getNearbyAccommodations', () => {
  afterEach(() => {
    delete process.env['BOOKING_COM_AFFILIATE_ID'];
    delete process.env['EXPEDIA_AFFILIATE_ID'];
  });

  it('returns cards for the destination', async () => {
    process.env['BOOKING_COM_AFFILIATE_ID'] = 'bookaid';
    const { service } = makeService();
    const cards = await service.getNearbyAccommodations('Austin, TX', 30.27, -97.74);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.provider).toBe('booking_com');
    expect(cards[0]!.coordinates).toEqual({ lat: 30.27, lng: -97.74 });
    expect(cards[0]!.affiliateUrl).toContain('ss=Austin%2C+TX');
  });

  it('returns no cards when no destination is provided', async () => {
    process.env['BOOKING_COM_AFFILIATE_ID'] = 'bookaid';
    const { service } = makeService();
    expect(await service.getNearbyAccommodations(undefined, 1, 2)).toHaveLength(0);
    expect(await service.getNearbyAccommodations('   ', 1, 2)).toHaveLength(0);
  });
});

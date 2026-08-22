import { Injectable, NotFoundException } from '@nestjs/common';
import type { AffiliateCard } from '../types';
import type { Stop as StopModel } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Affiliate deeplinks — no inventory/pricing is fetched (that requires live
// Booking.com/Expedia affiliate APIs). Cards link to provider search pages for
// the stop's city with the configured affiliate id; pricing is left null until
// a real feed is wired up.

@Injectable()
export class AffiliateService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccommodations(userId: string, tripId: string): Promise<AffiliateCard[]> {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id: tripId,
        OR: [{ userId }, { collaborators: { some: { userId } } }],
      },
      include: {
        tripStops: { orderBy: { order: 'asc' }, include: { stop: true } },
      },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }

    const cards: AffiliateCard[] = [];
    for (const ts of trip.tripStops) {
      const booking = this.bookingLink(ts.stop);
      const expedia = this.expediaLink(ts.stop);
      if (booking) cards.push(booking);
      if (expedia) cards.push(expedia);
    }
    return cards;
  }

  private bookingLink(stop: StopModel): AffiliateCard | null {
    const aid = process.env['BOOKING_COM_AFFILIATE_ID'];
    if (!aid) return null;
    return {
      provider: 'booking_com',
      name: `Hotels near ${stop.name}`,
      imageUrl: null,
      pricePerNight: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      affiliateUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(
        `${stop.city}, ${stop.state}`
      )}&aid=${encodeURIComponent(aid)}`,
      coordinates: { lat: stop.lat, lng: stop.lng },
    };
  }

  private expediaLink(stop: StopModel): AffiliateCard | null {
    const aid = process.env['EXPEDIA_AFFILIATE_ID'];
    if (!aid) return null;
    return {
      provider: 'expedia',
      name: `Hotels near ${stop.name}`,
      imageUrl: null,
      pricePerNight: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      affiliateUrl: `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(
        `${stop.city}, ${stop.state}`
      )}&affcid=${encodeURIComponent(aid)}`,
      coordinates: { lat: stop.lat, lng: stop.lng },
    };
  }
}

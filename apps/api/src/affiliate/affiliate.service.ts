import { Injectable, NotFoundException } from '@nestjs/common';
import type { AffiliateCard } from '../types';
import type { Stop as StopModel } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Affiliate deeplinks — no inventory/pricing is fetched (that requires live
// Booking.com/Expedia affiliate APIs). Cards link to provider search pages for
// the stop's city with the configured affiliate id; pricing is left null until
// a real feed is wired up.
//
// To upgrade to live pricing later: swap these deeplink builders for calls to
// the provider API (Booking.com affiliate hotel search or Expedia Rapid
// /properties) and fill pricePerNight/rating/reviewCount/imageUrl on the card.

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

    // One card per provider per destination city — a multi-stop trip that
    // visits the same city twice shouldn't produce duplicate hotel links.
    const seen = new Set<string>();
    const cards: AffiliateCard[] = [];
    for (const ts of trip.tripStops) {
      const key = `${ts.stop.city}|${ts.stop.state}`;
      if (seen.has(key)) continue;
      seen.add(key);

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
    const params = new URLSearchParams({
      ss: `${stop.city}, ${stop.state}`,
      aid,
      // Sub-account id lets partners split traffic across campaigns.
      ...(process.env['BOOKING_COM_SID'] && { sid: process.env['BOOKING_COM_SID'] }),
    });
    return {
      provider: 'booking_com',
      name: `Hotels in ${stop.city}`,
      imageUrl: null,
      pricePerNight: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      affiliateUrl: `https://www.booking.com/searchresults.html?${params.toString()}`,
      coordinates: { lat: stop.lat, lng: stop.lng },
    };
  }

  private expediaLink(stop: StopModel): AffiliateCard | null {
    const aid = process.env['EXPEDIA_AFFILIATE_ID'];
    if (!aid) return null;
    const params = new URLSearchParams({
      destination: `${stop.city}, ${stop.state}`,
      affcid: aid,
      // Travel Redirect-style deep link that keeps the traveler on Expedia for
      // the final booking; no separate inventory API required.
      ...(process.env['EXPEDIA_TRAVELER_ID'] && { tenant: process.env['EXPEDIA_TRAVELER_ID'] }),
    });
    return {
      provider: 'expedia',
      name: `Hotels in ${stop.city}`,
      imageUrl: null,
      pricePerNight: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      affiliateUrl: `https://www.expedia.com/Hotel-Search?${params.toString()}`,
      coordinates: { lat: stop.lat, lng: stop.lng },
    };
  }
}

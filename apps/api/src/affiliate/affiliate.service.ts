import { Injectable, NotFoundException } from '@nestjs/common';
import type { AffiliateCard } from '../types';
import { PrismaService } from '../prisma/prisma.service';
import { BookingProvider } from './booking.provider';
import { ExpediaProvider } from './expedia.provider';
import { destinationLabel, type AccommodationQuery } from './query';

// Accommodation recommendations for a trip or an arbitrary destination. Cards
// are affiliate deeplinks by default; when the Booking.com Affiliate API is
// configured, live hotels (price/rating/image) replace the deeplink for that
// city. See docs/affiliate-integration.md.
@Injectable()
export class AffiliateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly booking: BookingProvider,
    private readonly expedia: ExpediaProvider
  ) {}

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

    // One group of cards per destination city — a multi-stop trip that visits
    // the same city twice shouldn't produce duplicate hotel links.
    const seen = new Set<string>();
    const queries: AccommodationQuery[] = [];
    for (const ts of trip.tripStops) {
      const key = `${ts.stop.city}|${ts.stop.state}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queries.push({
        destination: destinationLabel(ts.stop.city, ts.stop.state),
        lat: ts.stop.lat,
        lng: ts.stop.lng,
      });
    }
    return this.cardsFor(queries);
  }

  /**
   * Accommodations for an arbitrary destination. `city` is required: without it
   * there is nothing to search on (and reverse-geocoding coordinates would add
   * a paid Google call), so an empty destination returns no cards.
   */
  async getNearbyAccommodations(
    city: string | undefined,
    lat: number,
    lng: number
  ): Promise<AffiliateCard[]> {
    const destination = city?.trim();
    if (!destination) return [];
    return this.cardsFor([{ destination, lat, lng }]);
  }

  private async cardsFor(queries: AccommodationQuery[]): Promise<AffiliateCard[]> {
    const groups = await Promise.all(
      queries.map(async (query) => {
        const booking = await this.booking.cards(query);
        const expedia = this.expedia.deeplink(query);
        return expedia ? [...booking, expedia] : booking;
      })
    );
    return groups.flat();
  }
}

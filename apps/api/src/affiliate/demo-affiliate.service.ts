import { Injectable, NotFoundException } from '@nestjs/common';
import type { AffiliateCard } from '@roadtrip4me/types';
import { PrismaService } from '../prisma/prisma.service';
import { demoAffiliateCards } from '../demo/demo-data';
import { AffiliateService } from './affiliate.service';
import { BookingProvider } from './booking.provider';
import { ExpediaProvider } from './expedia.provider';
import { Stay22Provider } from './stay22.provider';
import { TravelpayoutsProvider } from './travelpayouts.provider';
import { destinationLabel } from './query';

/**
 * Demo replacement for {@link AffiliateService}: returns placeholder cards for
 * each destination instead of building partner deeplinks (which need
 * credentials to be useful).
 */
@Injectable()
export class DemoAffiliateService extends AffiliateService {
  constructor(
    private readonly demoPrisma: PrismaService,
    booking: BookingProvider,
    expedia: ExpediaProvider,
    stay22: Stay22Provider,
    travelpayouts: TravelpayoutsProvider
  ) {
    super(demoPrisma, booking, expedia, stay22, travelpayouts);
  }

  override async getAccommodations(userId: string, tripId: string): Promise<AffiliateCard[]> {
    const trip = await this.demoPrisma.trip.findFirst({
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

    const seen = new Set<string>();
    const cards: AffiliateCard[] = [];
    for (const ts of trip.tripStops) {
      const key = `${ts.stop.city}|${ts.stop.state}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(
        ...demoAffiliateCards(destinationLabel(ts.stop.city, ts.stop.state), {
          lat: ts.stop.lat,
          lng: ts.stop.lng,
        })
      );
    }
    return cards;
  }

  override async getNearbyAccommodations(
    city: string | undefined,
    lat: number,
    lng: number
  ): Promise<AffiliateCard[]> {
    const destination = city?.trim();
    if (!destination) return [];
    return demoAffiliateCards(destination, { lat, lng });
  }
}

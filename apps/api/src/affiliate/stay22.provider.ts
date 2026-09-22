import { Injectable } from '@nestjs/common';
import type { AffiliateCard, AffiliateCategory } from '@roadtrip4me/types';
import type { AccommodationQuery } from './query';

/**
 * Stay22 "Allez" — a universal affiliate redirect across the major OTAs
 * (Booking.com, Expedia, Hotels.com, Vrbo, Agoda, GetYourGuide). No API key or
 * inventory API is required: `aid` tags the link and Stay22 routes the traveler
 * to the best-converting provider for their context. Stay22's Direct Travel API
 * is currently waitlist-only, so this provider only produces deeplink cards.
 *
 * See https://dev.stay22.com/docs/allez.
 */
@Injectable()
export class Stay22Provider {
  /** Accommodation card via `/allez/roam` (AI-picked OTA), or null without an aid. */
  deeplink(query: AccommodationQuery): AffiliateCard | null {
    return this.card(query, 'roam', 'accommodation', 'Stays');
  }

  /** Things-to-do card via `/allez/getyourguide`, or null without an aid. */
  activity(query: AccommodationQuery): AffiliateCard | null {
    return this.card(query, 'getyourguide', 'activity', 'Things to do');
  }

  /** Every Stay22 vertical for a destination (empty when unconfigured). */
  async cards(query: AccommodationQuery): Promise<AffiliateCard[]> {
    return [this.deeplink(query), this.activity(query)].filter(
      (card): card is AffiliateCard => card !== null
    );
  }

  private card(
    query: AccommodationQuery,
    slug: string,
    category: AffiliateCategory,
    label: string
  ): AffiliateCard | null {
    const aid = process.env['STAY22_AID'];
    if (!aid) return null;

    const params = new URLSearchParams({ aid });
    // Allez prefers coordinates over a free-text address; pass both so the
    // address still provides display context when geocoding is ambiguous.
    if (Number.isFinite(query.lat) && Number.isFinite(query.lng)) {
      params.set('lat', String(query.lat));
      params.set('lng', String(query.lng));
    }
    params.set('address', query.destination);
    const campaign = process.env['STAY22_CAMPAIGN'];
    if (campaign) params.set('campaign', campaign);

    return {
      provider: 'stay22',
      category,
      destination: query.destination,
      name: `${label} in ${query.destination}`,
      imageUrl: null,
      pricePerNight: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      affiliateUrl: `https://www.stay22.com/allez/${slug}?${params.toString()}`,
      coordinates: { lat: query.lat, lng: query.lng },
    };
  }
}

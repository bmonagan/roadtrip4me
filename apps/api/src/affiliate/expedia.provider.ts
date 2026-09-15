import { Injectable } from '@nestjs/common';
import type { AffiliateCard } from '@roadtrip4me/types';
import type { AccommodationQuery } from './query';

/**
 * Expedia referral deeplinks. No inventory API is used — the traveler completes
 * the booking on Expedia, and the link carries the affiliate / traveler ids.
 */
@Injectable()
export class ExpediaProvider {
  /** Affiliate-tagged search deeplink card, or null when no affiliate id is set. */
  deeplink(query: AccommodationQuery): AffiliateCard | null {
    const aid = process.env['EXPEDIA_AFFILIATE_ID'];
    if (!aid) return null;

    const params = new URLSearchParams({ destination: query.destination, affcid: aid });
    // Travel Redirect-style deep link keeps the traveler on Expedia for the
    // final booking; no separate inventory API required.
    const tenant = process.env['EXPEDIA_TRAVELER_ID'];
    if (tenant) params.set('tenant', tenant);

    return {
      provider: 'expedia',
      name: `Hotels in ${query.destination}`,
      imageUrl: null,
      pricePerNight: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      affiliateUrl: `https://www.expedia.com/Hotel-Search?${params.toString()}`,
      coordinates: { lat: query.lat, lng: query.lng },
    };
  }
}

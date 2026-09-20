import { Injectable } from '@nestjs/common';
import type { AffiliateCard } from '@roadtrip4me/types';
import type { AccommodationQuery } from './query';

/**
 * Travelpayouts deeplinks. Travelpayouts affiliate links are generated in their
 * dashboard (the "full link" carries the partner `marker`), so the URL shape is
 * configured rather than hard-coded:
 *
 *   TRAVELPAYOUTS_HOTEL_URL_TEMPLATE = a search URL containing `{destination}`
 *     (and optionally `{marker}` / `{subid}`), e.g.
 *     `https://example.tp.st/hotels?query={destination}&marker={marker}`
 *   TRAVELPAYOUTS_MARKER = the partner id substituted for `{marker}`
 *   TRAVELPAYOUTS_SUBID  = optional sub-id for click attribution
 *
 * The provider stays dormant until the template (and any placeholder it uses)
 * is configured, so no request shape is guessed on the user's behalf.
 */
@Injectable()
export class TravelpayoutsProvider {
  /** Affiliate-tagged card, or null when the template is missing/misconfigured. */
  deeplink(query: AccommodationQuery): AffiliateCard | null {
    const template = process.env['TRAVELPAYOUTS_HOTEL_URL_TEMPLATE'];
    if (!template || !template.includes('{destination}')) return null;

    const marker = process.env['TRAVELPAYOUTS_MARKER'];
    if (template.includes('{marker}') && !marker) return null;

    const subid = process.env['TRAVELPAYOUTS_SUBID'] ?? '';
    const affiliateUrl = template
      .replace(/\{destination\}/g, encodeURIComponent(query.destination))
      .replace(/\{marker\}/g, encodeURIComponent(marker ?? ''))
      .replace(/\{subid\}/g, encodeURIComponent(subid));

    return {
      provider: 'travelpayouts',
      name: `Hotels in ${query.destination}`,
      imageUrl: null,
      pricePerNight: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      affiliateUrl,
      coordinates: { lat: query.lat, lng: query.lng },
    };
  }

  /** Travelpayouts only produces deeplinks here; async kept for provider parity. */
  async cards(query: AccommodationQuery): Promise<AffiliateCard[]> {
    const card = this.deeplink(query);
    return card ? [card] : [];
  }
}

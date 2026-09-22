import { Injectable } from '@nestjs/common';
import type { AffiliateCard, AffiliateCategory } from '@roadtrip4me/types';
import type { AccommodationQuery } from './query';

interface Vertical {
  env: string;
  category: AffiliateCategory;
  label: string;
}

// Each vertical is configured independently and stays dormant until its
// template is set, so no request shape is guessed on the user's behalf.
const VERTICALS: Vertical[] = [
  { env: 'TRAVELPAYOUTS_HOTEL_URL_TEMPLATE', category: 'accommodation', label: 'Hotels' },
  { env: 'TRAVELPAYOUTS_ACTIVITY_URL_TEMPLATE', category: 'activity', label: 'Things to do' },
  { env: 'TRAVELPAYOUTS_CAR_URL_TEMPLATE', category: 'car_rental', label: 'Car rentals' },
];

/**
 * Travelpayouts deeplinks. Travelpayouts affiliate links are generated in their
 * dashboard (the "full link" carries the partner `marker`), so the URL shape is
 * configured rather than hard-coded:
 *
 *   TRAVELPAYOUTS_HOTEL_URL_TEMPLATE    = hotel search URL with `{destination}`
 *   TRAVELPAYOUTS_ACTIVITY_URL_TEMPLATE = Viator/GetYourGuide search URL
 *   TRAVELPAYOUTS_CAR_URL_TEMPLATE      = car-rental search URL
 *   TRAVELPAYOUTS_MARKER                = partner id substituted for `{marker}`
 *   TRAVELPAYOUTS_SUBID                 = optional sub-id for click attribution
 *
 * Templates may also use `{marker}` / `{subid}` placeholders. A vertical is
 * active only when its template contains `{destination}` (and, if it references
 * `{marker}`, the marker is set).
 */
@Injectable()
export class TravelpayoutsProvider {
  /** Accommodation card, or null when the hotel template is unconfigured. */
  deeplink(query: AccommodationQuery): AffiliateCard | null {
    return this.card(query, VERTICALS[0]!);
  }

  /** Things-to-do card, or null when the activity template is unconfigured. */
  activity(query: AccommodationQuery): AffiliateCard | null {
    return this.card(query, VERTICALS[1]!);
  }

  /** Car-rental card, or null when the car template is unconfigured. */
  carRental(query: AccommodationQuery): AffiliateCard | null {
    return this.card(query, VERTICALS[2]!);
  }

  /** Every configured Travelpayouts vertical for a destination. */
  async cards(query: AccommodationQuery): Promise<AffiliateCard[]> {
    return VERTICALS.map((vertical) => this.card(query, vertical)).filter(
      (card): card is AffiliateCard => card !== null
    );
  }

  private card(query: AccommodationQuery, vertical: Vertical): AffiliateCard | null {
    const template = process.env[vertical.env];
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
      category: vertical.category,
      name: `${vertical.label} in ${query.destination}`,
      imageUrl: null,
      pricePerNight: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      affiliateUrl,
      coordinates: { lat: query.lat, lng: query.lng },
    };
  }
}

import type { AffiliateCard } from '@roadtrip4me/types';
import type { GeoPoint } from '../common/geo';

/**
 * Canned data used when `DEMO_MODE=true`. It mirrors the shape returned by the
 * real external services so the demo providers are drop-in replacements.
 */

// Mirrors the DeepSeek JSON contract (see recommendations/deepseek.ts): a
// `{ stops: [...] }` object that `parseStops` validates.
export function demoRecommendationResponse(): unknown {
  return {
    stops: [
      {
        name: 'Palo Duro Canyon State Park',
        description:
          'The second-largest canyon in the US, with dramatic red-rock layers and a scenic loop drive.',
        category: 'park',
        city: 'Canyon',
        state: 'TX',
        lat: 34.9372,
        lng: -101.6584,
        reasoning: 'A short detour off I-40 between Amarillo and the Texas panhandle.',
      },
      {
        name: 'Cadillac Ranch',
        description: 'Ten graffiti-covered Cadillacs planted nose-down in a wheat field.',
        category: 'attraction',
        city: 'Amarillo',
        state: 'TX',
        lat: 35.1872,
        lng: -101.9872,
        reasoning: 'The definitive Route 66 roadside photo stop.',
      },
      {
        name: 'Blue Hole of Santa Rosa',
        description: 'A bell-shaped, spring-fed swimming hole with startlingly clear turquoise water.',
        category: 'viewpoint',
        city: 'Santa Rosa',
        state: 'NM',
        lat: 34.9406,
        lng: -104.6758,
        reasoning: 'A refreshing break on a long desert stretch.',
      },
      {
        name: 'El Rancho Hotel',
        description: 'A 1937 hotel that hosted movie stars; a classic Route 66 lodging icon.',
        category: 'lodging',
        city: 'Gallup',
        state: 'NM',
        lat: 35.5281,
        lng: -108.7426,
        reasoning: 'Historic overnight stop with real Route 66 character.',
      },
      {
        name: 'Petrified Forest National Park',
        description: '225-million-year-old petrified logs and the rainbow-hued Painted Desert.',
        category: 'park',
        city: 'Holbrook',
        state: 'AZ',
        lat: 34.9828,
        lng: -109.7877,
        reasoning: 'A national park directly on the corridor.',
      },
      {
        name: 'Hackberry General Store',
        description: 'A time-warp general store plastered in old signs and memorabilia.',
        category: 'shopping',
        city: 'Hackberry',
        state: 'AZ',
        lat: 35.3697,
        lng: -113.7069,
        reasoning: 'The most photographed stretch of old Route 66 in Arizona.',
      },
    ],
  };
}

// Placeholder affiliate cards so the "Where to stay" section renders without
// any partner credentials. URLs intentionally point at the providers' public
// home pages (no affiliate tracking).
export function demoAffiliateCards(destination: string, coordinates: GeoPoint): AffiliateCard[] {
  const image = (seed: string) =>
    `https://picsum.photos/seed/roadtrip4me-${encodeURIComponent(seed)}/640/400`;

  return [
    {
      provider: 'stay22',
      category: 'accommodation',
      name: `The Route 66 Inn — ${destination}`,
      destination,
      imageUrl: image(`stay-${destination}`),
      pricePerNight: 129,
      currency: 'USD',
      rating: 8.6,
      reviewCount: 412,
      affiliateUrl: 'https://www.stay22.com/',
      coordinates,
    },
    {
      provider: 'booking_com',
      category: 'accommodation',
      name: `Historic Motor Lodge — ${destination}`,
      destination,
      imageUrl: image(`booking-${destination}`),
      pricePerNight: 98,
      currency: 'USD',
      rating: 8.1,
      reviewCount: 274,
      affiliateUrl: 'https://www.booking.com/',
      coordinates,
    },
    {
      provider: 'stay22',
      category: 'activity',
      name: `Route 66 guided day tour — ${destination}`,
      destination,
      imageUrl: image(`activity-${destination}`),
      pricePerNight: null,
      currency: 'USD',
      rating: 4.8,
      reviewCount: 96,
      affiliateUrl: 'https://www.getyourguide.com/',
      coordinates,
    },
    {
      provider: 'travelpayouts',
      category: 'car_rental',
      name: `Convertible rental — ${destination}`,
      destination,
      imageUrl: image(`car-${destination}`),
      pricePerNight: 64,
      currency: 'USD',
      rating: 4.5,
      reviewCount: 52,
      affiliateUrl: 'https://www.discovercars.com/',
      coordinates,
    },
  ];
}

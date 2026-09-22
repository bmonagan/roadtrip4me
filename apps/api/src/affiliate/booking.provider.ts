import { Injectable, Logger } from '@nestjs/common';
import type { AffiliateCard } from '@roadtrip4me/types';
import { TtlCache } from '../common/ttl-cache';
import type { AccommodationQuery } from './query';

const SEARCH_TIMEOUT_MS = 8_000;
// Live prices move hourly, but a 6h window keeps API usage (and cost) low while
// still looking fresh to a traveler planning a trip.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const MAX_HOTELS = 6;

/**
 * Booking.com inventory. Two modes:
 *
 *  - Deeplink (always available once `BOOKING_COM_AFFILIATE_ID` is set): a
 *    search-results URL tagged with the affiliate id. Earns commission with no
 *    API approval or per-request cost.
 *  - Live API (opt-in): when `BOOKING_COM_API_ENABLED=true` and the API
 *    credentials/URL are configured, real hotels with price/rating/image are
 *    returned. Any failure falls back to the deeplink card so a trip page never
 *    breaks because a provider is down.
 *
 * The request shape and response mapping are intentionally isolated in
 * `fetchHotels` / `mapBookingHotels` — those are the only places to adjust once
 * Booking.com confirms the exact endpoint and auth scheme at approval.
 */
@Injectable()
export class BookingProvider {
  private readonly logger = new Logger(BookingProvider.name);
  private readonly cache = new TtlCache<AffiliateCard[]>({
    ttlMs: CACHE_TTL_MS,
    maxEntries: CACHE_MAX_ENTRIES,
  });
  // Collapse concurrent misses for the same destination into one API call.
  private readonly inFlight = new Map<string, Promise<AffiliateCard[]>>();

  /**
   * Live hotel cards, or an empty array when the API is disabled, unconfigured,
   * or the request fails. Callers fall back to `deeplink()`.
   */
  async search(query: AccommodationQuery): Promise<AffiliateCard[]> {
    if (!this.apiConfigured()) return [];

    const key = query.destination.trim().toLowerCase();
    const cached = this.cache.get(key);
    if (cached) return cached;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = this.fetchHotels(query)
      .then((cards) => {
        // Only cache real results — a transient empty/failed response should
        // not stick for the whole TTL window.
        if (cards.length > 0) this.cache.set(key, cards);
        return cards;
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Booking.com API search failed for "${query.destination}": ${(error as Error).message}`
        );
        return [] as AffiliateCard[];
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, request);
    return request;
  }

  /** Affiliate-tagged search deeplink card, or null when no affiliate id is set. */
  deeplink(query: AccommodationQuery): AffiliateCard | null {
    const url = this.deeplinkUrl(query);
    if (!url) return null;
    return {
      provider: 'booking_com',
      category: 'accommodation',
      destination: query.destination,
      name: `Hotels in ${query.destination}`,
      imageUrl: null,
      pricePerNight: null,
      currency: 'USD',
      rating: null,
      reviewCount: null,
      affiliateUrl: url,
      coordinates: { lat: query.lat, lng: query.lng },
    };
  }

  /** Live cards when available, otherwise the deeplink card (or nothing). */
  async cards(query: AccommodationQuery): Promise<AffiliateCard[]> {
    const live = await this.search(query);
    if (live.length > 0) return live;
    const fallback = this.deeplink(query);
    return fallback ? [fallback] : [];
  }

  private apiConfigured(): boolean {
    return (
      process.env['BOOKING_COM_API_ENABLED'] === 'true' &&
      Boolean(process.env['BOOKING_COM_API_URL']) &&
      Boolean(process.env['BOOKING_COM_API_TOKEN']) &&
      Boolean(process.env['BOOKING_COM_AFFILIATE_ID'])
    );
  }

  private deeplinkUrl(query: AccommodationQuery): string | null {
    const aid = process.env['BOOKING_COM_AFFILIATE_ID'];
    if (!aid) return null;
    const params = new URLSearchParams({ ss: query.destination, aid });
    const sid = process.env['BOOKING_COM_SID'];
    if (sid) params.set('sid', sid);
    return `https://www.booking.com/searchresults.html?${params.toString()}`;
  }

  private async fetchHotels(query: AccommodationQuery): Promise<AffiliateCard[]> {
    const apiUrl = process.env['BOOKING_COM_API_URL'];
    const token = process.env['BOOKING_COM_API_TOKEN'];
    const aid = process.env['BOOKING_COM_AFFILIATE_ID'];
    if (!apiUrl || !token || !aid) return [];

    const url = new URL(apiUrl);
    url.searchParams.set('aid', aid);
    url.searchParams.set('city', query.destination);
    url.searchParams.set('latitude', String(query.lat));
    url.searchParams.set('longitude', String(query.lng));
    const sid = process.env['BOOKING_COM_SID'];
    if (sid) url.searchParams.set('sid', sid);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${aid}:${token}`).toString('base64')}`,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      throw new Error(`Booking.com API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const fallbackUrl = this.deeplinkUrl(query) ?? '';
    return mapBookingHotels((await res.json()) as unknown, query, fallbackUrl);
  }
}

/**
 * Maps a Booking.com API response to cards. Tolerant of the field names used by
 * the various Booking partner APIs; unknown shapes simply yield no live cards
 * and the caller falls back to deeplinks.
 */
export function mapBookingHotels(
  data: unknown,
  query: AccommodationQuery,
  fallbackUrl: string
): AffiliateCard[] {
  const cards: AffiliateCard[] = [];
  for (const row of extractRows(data)) {
    if (!isRecord(row)) continue;
    const name = firstString(row['hotel_name'], row['name'], row['hotelName']);
    if (!name) continue;

    cards.push({
      provider: 'booking_com',
      category: 'accommodation',
      destination: query.destination,
      name,
      imageUrl: firstImage(row['photo_urls'], row['image_url'], row['imageUrl'], row['main_photo_url']),
      pricePerNight: firstNumber(
        row['price'],
        row['min_total_price'],
        row['pricePerNight'],
        row['price_per_night']
      ),
      currency: firstString(row['currency_code'], row['currency'], row['currencyCode']) ?? 'USD',
      rating: firstNumber(row['review_score'], row['rating'], row['reviewScore']),
      reviewCount: firstNumber(row['review_nr'], row['reviewCount'], row['review_count']),
      affiliateUrl: firstString(row['url'], row['deeplink'], row['affiliateUrl']) ?? fallbackUrl,
      coordinates: { lat: query.lat, lng: query.lng },
    });
    if (cards.length >= MAX_HOTELS) break;
  }
  return cards.filter((card) => card.affiliateUrl);
}

function extractRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];
  for (const key of ['result', 'results', 'hotels', 'data', 'items']) {
    const candidate = data[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function firstImage(...values: unknown[]): string | null {
  for (const value of values) {
    const direct = firstString(value);
    if (direct) return direct;
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string') return first;
      if (isRecord(first)) {
        const url = firstString(first['url'], first['image_url'], first['src']);
        if (url) return url;
      }
    }
  }
  return null;
}

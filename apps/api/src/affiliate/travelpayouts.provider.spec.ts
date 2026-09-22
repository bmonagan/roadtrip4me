import { afterEach, describe, expect, it } from 'vitest';
import { TravelpayoutsProvider } from './travelpayouts.provider';
import type { AccommodationQuery } from './query';

const query: AccommodationQuery = { destination: 'Chicago, IL', lat: 41.88, lng: -87.63 };

function clearEnv() {
  for (const key of [
    'TRAVELPAYOUTS_HOTEL_URL_TEMPLATE',
    'TRAVELPAYOUTS_ACTIVITY_URL_TEMPLATE',
    'TRAVELPAYOUTS_CAR_URL_TEMPLATE',
    'TRAVELPAYOUTS_MARKER',
    'TRAVELPAYOUTS_SUBID',
  ]) {
    delete process.env[key];
  }
}

describe('TravelpayoutsProvider', () => {
  afterEach(clearEnv);

  it('is dormant without a template', () => {
    process.env['TRAVELPAYOUTS_MARKER'] = 'marker123';
    expect(new TravelpayoutsProvider().deeplink(query)).toBeNull();
  });

  it('is dormant when the template has no {destination} placeholder', () => {
    process.env['TRAVELPAYOUTS_HOTEL_URL_TEMPLATE'] = 'https://example.tp.st/hotels?marker=abc';
    expect(new TravelpayoutsProvider().deeplink(query)).toBeNull();
  });

  it('substitutes the destination, marker and subid', () => {
    process.env['TRAVELPAYOUTS_HOTEL_URL_TEMPLATE'] =
      'https://example.tp.st/hotels?query={destination}&marker={marker}&subid={subid}';
    process.env['TRAVELPAYOUTS_MARKER'] = 'marker123';
    process.env['TRAVELPAYOUTS_SUBID'] = 'stop-card';
    const card = new TravelpayoutsProvider().deeplink(query)!;

    expect(card.provider).toBe('travelpayouts');
    expect(card.category).toBe('accommodation');
    expect(card.name).toBe('Hotels in Chicago, IL');
    expect(card.affiliateUrl).toContain('query=Chicago%2C%20IL');
    expect(card.affiliateUrl).toContain('marker=marker123');
    expect(card.affiliateUrl).toContain('subid=stop-card');
    expect(card.coordinates).toEqual({ lat: 41.88, lng: -87.63 });
  });

  it('requires a marker when the template references one', () => {
    process.env['TRAVELPAYOUTS_HOTEL_URL_TEMPLATE'] =
      'https://example.tp.st/hotels?query={destination}&marker={marker}';
    expect(new TravelpayoutsProvider().deeplink(query)).toBeNull();
  });

  it('builds activity and car-rental cards from their own templates', () => {
    process.env['TRAVELPAYOUTS_ACTIVITY_URL_TEMPLATE'] =
      'https://example.tp.st/tours?query={destination}';
    process.env['TRAVELPAYOUTS_CAR_URL_TEMPLATE'] =
      'https://example.tp.st/cars?pickup={destination}';
    const provider = new TravelpayoutsProvider();

    expect(provider.activity(query)).toMatchObject({
      category: 'activity',
      name: 'Things to do in Chicago, IL',
    });
    expect(provider.carRental(query)).toMatchObject({
      category: 'car_rental',
      name: 'Car rentals in Chicago, IL',
    });
  });

  it('cards() returns every configured vertical and is empty when dormant', async () => {
    process.env['TRAVELPAYOUTS_HOTEL_URL_TEMPLATE'] =
      'https://example.tp.st/hotels?query={destination}';
    process.env['TRAVELPAYOUTS_CAR_URL_TEMPLATE'] =
      'https://example.tp.st/cars?pickup={destination}';
    const provider = new TravelpayoutsProvider();
    expect((await provider.cards(query)).map((c) => c.category)).toEqual([
      'accommodation',
      'car_rental',
    ]);

    clearEnv();
    expect(await provider.cards(query)).toHaveLength(0);
  });
});

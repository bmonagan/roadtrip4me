import { afterEach, describe, expect, it } from 'vitest';
import { Stay22Provider } from './stay22.provider';
import type { AccommodationQuery } from './query';

const query: AccommodationQuery = { destination: 'Chicago, IL', lat: 41.88, lng: -87.63 };

function clearEnv() {
  for (const key of ['STAY22_AID', 'STAY22_CAMPAIGN']) {
    delete process.env[key];
  }
}

describe('Stay22Provider', () => {
  afterEach(clearEnv);

  it('builds an accommodation Allez link with the aid, coordinates and address', () => {
    process.env['STAY22_AID'] = 'aid123';
    const card = new Stay22Provider().deeplink(query)!;

    expect(card.provider).toBe('stay22');
    expect(card.category).toBe('accommodation');
    expect(card.name).toBe('Stays in Chicago, IL');
    expect(card.affiliateUrl).toContain('https://www.stay22.com/allez/roam?');
    expect(card.affiliateUrl).toContain('aid=aid123');
    expect(card.affiliateUrl).toContain('lat=41.88');
    expect(card.affiliateUrl).toContain('lng=-87.63');
    expect(card.affiliateUrl).toContain('address=Chicago%2C+IL');
    expect(card.pricePerNight).toBeNull();
    expect(card.coordinates).toEqual({ lat: 41.88, lng: -87.63 });
  });

  it('builds an activities link via GetYourGuide', () => {
    process.env['STAY22_AID'] = 'aid123';
    const card = new Stay22Provider().activity(query)!;

    expect(card.category).toBe('activity');
    expect(card.name).toBe('Things to do in Chicago, IL');
    expect(card.affiliateUrl).toContain('https://www.stay22.com/allez/getyourguide?');
    expect(card.affiliateUrl).toContain('aid=aid123');
  });

  it('includes the campaign when configured', () => {
    process.env['STAY22_AID'] = 'aid123';
    process.env['STAY22_CAMPAIGN'] = 'roadtrip4me';
    expect(new Stay22Provider().deeplink(query)!.affiliateUrl).toContain('campaign=roadtrip4me');
  });

  it('returns null without an aid', () => {
    const provider = new Stay22Provider();
    expect(provider.deeplink(query)).toBeNull();
    expect(provider.activity(query)).toBeNull();
  });

  it('cards() returns both verticals and is empty without an aid', async () => {
    process.env['STAY22_AID'] = 'aid123';
    const provider = new Stay22Provider();
    const cards = await provider.cards(query);
    expect(cards.map((c) => c.category)).toEqual(['accommodation', 'activity']);

    clearEnv();
    expect(await provider.cards(query)).toHaveLength(0);
  });
});

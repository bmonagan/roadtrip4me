import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AffiliateCard } from '@roadtrip4me/types';
import AffiliateCardSections from './AffiliateCardSections';

function card(
  category: AffiliateCard['category'],
  name: string,
  provider: AffiliateCard['provider'] = 'stay22'
): AffiliateCard {
  return {
    provider,
    category,
    name,
    imageUrl: null,
    pricePerNight: null,
    currency: 'USD',
    rating: null,
    reviewCount: null,
    affiliateUrl: 'https://example.test/x',
    coordinates: { lat: 1, lng: 2 },
  };
}

describe('AffiliateCardSections', () => {
  it('groups cards under the right headings in road-trip order', () => {
    const { container } = render(
      <AffiliateCardSections
        cards={[
          card('car_rental', 'Car rentals in Austin, TX'),
          card('accommodation', 'Stays in Austin, TX'),
          card('activity', 'Things to do in Austin, TX'),
        ]}
      />
    );

    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent);
    expect(headings).toEqual(['Where to stay', 'Things to do', 'Getting around']);
    expect(screen.getByText('Stays in Austin, TX')).toBeTruthy();
  });

  it('omits categories with no cards', () => {
    render(<AffiliateCardSections cards={[card('accommodation', 'Stays in Austin, TX')]} />);
    expect(screen.getByText('Where to stay')).toBeTruthy();
    expect(screen.queryByText('Things to do')).toBeNull();
    expect(screen.queryByText('Getting around')).toBeNull();
  });
});

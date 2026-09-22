import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AffiliateCard } from '@roadtrip4me/types';
import AccommodationList from './AccommodationList';

const base: AffiliateCard = {
  provider: 'booking_com',
  category: 'accommodation',
  name: 'The Loop Hotel',
  imageUrl: null,
  pricePerNight: null,
  currency: 'USD',
  rating: null,
  reviewCount: null,
  affiliateUrl: 'https://www.booking.com/searchresults.html?aid=bookaid',
  coordinates: { lat: 41.88, lng: -87.63 },
};

describe('AccommodationList', () => {
  it('renders a deeplink-only card without pricing details', () => {
    render(<AccommodationList cards={[base]} />);
    expect(screen.getByText('The Loop Hotel')).toBeTruthy();
    expect(screen.getByText('Booking.com')).toBeTruthy();
    expect(screen.queryByText(/\/ night/)).toBeNull();
  });

  it('renders price, rating and review count when present', () => {
    render(
      <AccommodationList
        cards={[
          {
            ...base,
            pricePerNight: 199,
            rating: 8.7,
            reviewCount: 1234,
            imageUrl: 'https://img.test/a.jpg',
          },
        ]}
      />
    );
    expect(screen.getByText(/\$199 \/ night/)).toBeTruthy();
    expect(screen.getByText(/★ 8\.7/)).toBeTruthy();
    expect(screen.getByText(/1,234/)).toBeTruthy();
    expect(document.querySelector('.accommodation-image')).toBeTruthy();
  });

  it('tags affiliate links as sponsored and opens in a new tab', () => {
    render(<AccommodationList cards={[base]} />);
    const link = screen.getByRole('link', { name: 'View deals' });
    expect(link.getAttribute('rel')).toContain('sponsored');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('labels Expedia cards', () => {
    render(<AccommodationList cards={[{ ...base, provider: 'expedia' }]} />);
    expect(screen.getByText('Expedia')).toBeTruthy();
  });
});

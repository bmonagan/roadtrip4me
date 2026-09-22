import type { AffiliateCard } from '@roadtrip4me/types';
import { api } from '../lib/api';

const PROVIDER_LABELS: Record<AffiliateCard['provider'], string> = {
  booking_com: 'Booking.com',
  expedia: 'Expedia',
  stay22: 'Stay22',
  travelpayouts: 'Travelpayouts',
};

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain label rather than throwing.
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export default function AccommodationList({
  cards,
  tripId,
}: {
  cards: AffiliateCard[];
  tripId?: string;
}) {
  return (
    <ul className="card-list accommodation-list">
      {cards.map((card, i) => {
        const hasMeta = card.pricePerNight !== null || card.rating !== null;
        return (
          <li key={`${card.provider}-${card.affiliateUrl}-${i}`} className="card accommodation-card">
            {card.imageUrl && (
              <img
                className="accommodation-image"
                src={card.imageUrl}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="card-body">
              <h3>{card.name}</h3>
              <p className="muted">{PROVIDER_LABELS[card.provider]}</p>
              {hasMeta && (
                <p className="accommodation-meta">
                  {card.pricePerNight !== null && (
                    <span className="accommodation-price">
                      {formatPrice(card.pricePerNight, card.currency)} / night
                    </span>
                  )}
                  {card.rating !== null && (
                    <span className="accommodation-rating">
                      ★ {card.rating.toFixed(1)}
                      {card.reviewCount !== null && ` (${card.reviewCount.toLocaleString()})`}
                    </span>
                  )}
                </p>
              )}
            </div>
            <a
              href={card.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="btn primary"
              onClick={() =>
                api.affiliate.trackClick({
                  provider: card.provider,
                  category: card.category,
                  destination: card.destination,
                  tripId,
                })
              }
            >
              View deals
            </a>
          </li>
        );
      })}
    </ul>
  );
}

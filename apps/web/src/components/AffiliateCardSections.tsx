import type { AffiliateCard, AffiliateCategory } from '@roadtrip4me/types';
import AccommodationList from './AccommodationList';

const HEADINGS: Record<AffiliateCategory, string> = {
  accommodation: 'Where to stay',
  activity: 'Things to do',
  car_rental: 'Getting around',
};

const ORDER: AffiliateCategory[] = ['accommodation', 'activity', 'car_rental'];

/**
 * Groups affiliate cards into road-trip sections (stay / do / drive). Sections
 * with no cards are omitted, so a destination with only hotels renders just
 * "Where to stay".
 */
export default function AffiliateCardSections({ cards }: { cards: AffiliateCard[] }) {
  const groups = ORDER.map((category) => ({
    category,
    cards: cards.filter((card) => card.category === category),
  })).filter((group) => group.cards.length > 0);

  return (
    <>
      {groups.map((group) => (
        <section key={group.category} className="stops-section">
          <h2>{HEADINGS[group.category]}</h2>
          <AccommodationList cards={group.cards} />
        </section>
      ))}
    </>
  );
}

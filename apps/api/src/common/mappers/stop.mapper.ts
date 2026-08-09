import type { Stop } from '@roadtrip4me/types';

export type StopRecord = {
  id: string;
  name: string;
  description: string | null;
  category: Stop['category'];
  imageUrl: string | null;
  lat: number;
  lng: number;
  street: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string | null;
  externalId: string | null;
  score: number;
  voteCount: number;
  submittedByUserId: string | null;
  createdAt: Date;
};

export function mapStop(stop: StopRecord): Stop {
  return {
    id: stop.id,
    name: stop.name,
    description: stop.description,
    coordinates: { lat: stop.lat, lng: stop.lng },
    address: {
      street: stop.street,
      city: stop.city,
      state: stop.state,
      country: stop.country,
      postalCode: stop.postalCode,
    },
    category: stop.category,
    imageUrl: stop.imageUrl,
    externalId: stop.externalId,
    score: stop.score,
    voteCount: stop.voteCount,
    submittedByUserId: stop.submittedByUserId,
    createdAt: stop.createdAt.toISOString(),
  };
}

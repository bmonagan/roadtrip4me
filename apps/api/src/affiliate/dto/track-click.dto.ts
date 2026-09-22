import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AffiliateCard, AffiliateCategory } from '@roadtrip4me/types';

const PROVIDERS: AffiliateCard['provider'][] = [
  'booking_com',
  'expedia',
  'stay22',
  'travelpayouts',
];

const CATEGORIES: AffiliateCategory[] = ['accommodation', 'activity', 'car_rental'];

/** Fire-and-forget payload sent by the web when an affiliate link is clicked. */
export class TrackClickDto {
  @IsIn(PROVIDERS)
  provider!: AffiliateCard['provider'];

  @IsIn(CATEGORIES)
  category!: AffiliateCategory;

  @IsString()
  @MaxLength(200)
  destination!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  tripId?: string;
}

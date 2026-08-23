import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { TripStatus, TripVibe } from '../../types';
import { PlaceDto } from './create-trip.dto';
import { IsAfterDate } from '../../common/validators/is-after-date.validator';

const TRIP_STATUSES = ['draft', 'planned', 'in_progress', 'completed'] as const;
const TRIP_VIBES = ['scenic', 'foodie', 'adventure', 'historic', 'relaxed', 'family'] as const;

export class UpdateTripDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsIn(TRIP_STATUSES)
  status?: TripStatus;

  @IsOptional()
  @IsArray()
  @IsIn(TRIP_VIBES, { each: true })
  vibes?: TripVibe[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaceDto)
  origin?: PlaceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PlaceDto)
  destination?: PlaceDto;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @IsAfterDate('startDate', { message: 'endDate must be on or after startDate' })
  endDate?: string;
}

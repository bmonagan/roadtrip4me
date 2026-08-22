import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { TripVibe } from '../../types';

const TRIP_VIBES = ['scenic', 'foodie', 'adventure', 'historic', 'relaxed', 'family'] as const;

export class PreferencesDto {
  @IsOptional()
  @IsBoolean()
  avoidHighways: boolean = false;

  @IsOptional()
  @IsBoolean()
  preferNationalParks: boolean = false;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  foodPreferences: string[] = [];
}

export class RecommendationRequestDto {
  @IsOptional()
  @IsArray()
  @IsIn(TRIP_VIBES, { each: true })
  vibes?: TripVibe[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  maxDetourMinutes: number = 20;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreferencesDto)
  preferences: PreferencesDto = new PreferencesDto();
}

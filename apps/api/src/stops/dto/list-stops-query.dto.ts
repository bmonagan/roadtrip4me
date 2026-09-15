import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { StopCategory } from '@roadtrip4me/types';

const STOP_CATEGORIES = [
  'restaurant',
  'attraction',
  'gas_station',
  'lodging',
  'park',
  'viewpoint',
  'campground',
  'museum',
  'shopping',
  'other',
] as const;

export class ListStopsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 20;

  @IsOptional()
  @IsIn(STOP_CATEGORIES)
  category?: StopCategory;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

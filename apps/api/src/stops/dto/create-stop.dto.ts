import { Type } from 'class-transformer';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
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

export class CreateStopCoordinatesDto {
  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

export class CreateStopAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;
}

export class CreateStopDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsIn(STOP_CATEGORIES)
  category!: StopCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ValidateNested()
  @Type(() => CreateStopCoordinatesDto)
  coordinates!: CreateStopCoordinatesDto;

  @ValidateNested()
  @Type(() => CreateStopAddressDto)
  address!: CreateStopAddressDto;
}

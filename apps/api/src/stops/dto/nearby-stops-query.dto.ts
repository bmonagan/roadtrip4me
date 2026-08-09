import { Type } from 'class-transformer';
import { IsInt, IsLatitude, IsLongitude, IsOptional, Max, Min } from 'class-validator';

export class NearbyStopsQueryDto {
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(200_000)
  radiusMeters: number = 50_000;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

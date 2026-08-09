import { IsLatitude, IsLongitude, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddWaypointDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsLatitude()
  lat!: number;

  @IsLongitude()
  lng!: number;
}

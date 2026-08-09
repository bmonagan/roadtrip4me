import { IsNotEmpty, IsString } from 'class-validator';

export class AddStopDto {
  @IsString()
  @IsNotEmpty()
  stopId!: string;
}

import { IsBoolean, IsOptional } from 'class-validator';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsBoolean()
  isAdmin?: boolean;
}

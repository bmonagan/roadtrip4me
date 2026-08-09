import { IsEmail, IsNotEmpty } from 'class-validator';

export class AddCollaboratorDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

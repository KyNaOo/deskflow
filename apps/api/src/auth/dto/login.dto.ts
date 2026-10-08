import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimAndLowercase } from './transforms.js';

export class LoginDto {
  @Transform(trimAndLowercase)
  @IsString()
  @IsNotEmpty()
  tenantSlug: string;

  @Transform(trimAndLowercase)
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

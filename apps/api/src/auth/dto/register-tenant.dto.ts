import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsNotIn, IsString, Length, Matches, MaxLength } from 'class-validator';
import { trim, trimAndLowercase } from './transforms.js';

/** Premiers segments d'URL déjà utilisés par le front : un tenant ne peut pas les prendre. */
export const RESERVED_SLUGS = ['login', 'register', 'invitations', 'refresh', 'portal', 'api'];

export class RegisterTenantDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  organizationName: string;

  /** Identifiant de l'organisation dans les URLs : `acme-corp` */
  @Transform(trimAndLowercase)
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug ne peut contenir que des lettres minuscules, des chiffres et des tirets',
  })
  @IsNotIn(RESERVED_SLUGS, { message: 'ce slug est réservé' })
  slug: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(trimAndLowercase)
  @IsEmail()
  email: string;

  // Borne haute : évite de faire hasher par argon2 des chaînes énormes (déni de service)
  @IsString()
  @Length(8, 128)
  password: string;
}

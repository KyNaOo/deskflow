import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalize = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterTenantDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  organizationName: string;

  /** Identifiant de l'organisation dans les URLs : `acme-corp` */
  @Transform(normalize)
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug ne peut contenir que des lettres minuscules, des chiffres et des tirets',
  })
  slug: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Transform(normalize)
  @IsEmail()
  email: string;

  // Borne haute : évite de faire hasher par argon2 des chaînes énormes (déni de service)
  @IsString()
  @Length(8, 128)
  password: string;
}

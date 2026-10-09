import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';
import { trim } from './transforms.js';

export class AcceptInvitationDto {
  /** Jeton reçu dans le lien de l'e-mail d'invitation */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  token: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  // Borne haute : évite de faire hasher par argon2 des chaînes énormes (déni de service)
  @IsString()
  @Length(8, 128)
  password: string;
}

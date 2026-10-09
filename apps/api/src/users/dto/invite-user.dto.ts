import { Transform } from 'class-transformer';
import { IsEmail, IsIn } from 'class-validator';
import { trimAndLowercase } from '../../auth/dto/transforms.js';
import { Role } from '../../generated/prisma/client.js';

/** Les clients ne sont pas invités : ils créent leur compte depuis le portail (Jalon 2). */
export const INVITABLE_ROLES = [Role.AGENT, Role.ADMIN] as const;

export class InviteUserDto {
  @Transform(trimAndLowercase)
  @IsEmail()
  email: string;

  @IsIn(INVITABLE_ROLES)
  role: (typeof INVITABLE_ROLES)[number];
}

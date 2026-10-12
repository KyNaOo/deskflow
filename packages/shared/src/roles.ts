import { z } from 'zod';

// Mêmes valeurs que les enums Prisma de l'api (prisma/schema.prisma)
export const ROLES = ['ADMIN', 'AGENT', 'CUSTOMER'] as const;
export type Role = (typeof ROLES)[number];

/** Les clients ne sont pas invités : ils créent leur compte depuis le portail. */
export const INVITABLE_ROLES = ['AGENT', 'ADMIN'] as const satisfies readonly Role[];

export const roleSchema = z.enum(ROLES);

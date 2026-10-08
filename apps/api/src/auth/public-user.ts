import type { Prisma } from '../generated/prisma/client.js';

/** Champs d'un utilisateur renvoyés par l'API : jamais le hash du mot de passe. */
export const publicUserSelect = {
  id: true,
  tenantId: true,
  name: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

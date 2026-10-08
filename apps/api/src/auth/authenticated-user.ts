import type { Request } from 'express';
import type { User } from '../generated/prisma/client.js';

/** Utilisateur de la requête courante, déduit de l'access token (sans lecture en base). */
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  role: User['role'];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

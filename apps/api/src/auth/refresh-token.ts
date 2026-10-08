import { createHash, randomBytes } from 'node:crypto';

/** Jeton opaque : 256 bits aléatoires, il ne contient aucune information. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 et non argon2 : le jeton est déjà impossible à deviner (256 bits aléatoires),
 * et il faut pouvoir le retrouver en base par son empreinte, ce qu'un hash salé empêche.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

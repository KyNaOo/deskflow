import { createHash, randomBytes } from 'node:crypto';

/**
 * Jeton opaque à usage unique (refresh token, invitation) : 256 bits aléatoires,
 * il ne contient aucune information. Seule son empreinte est stockée en base.
 */
export function generateSecretToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 et non argon2 : le jeton est déjà impossible à deviner (256 bits aléatoires),
 * et il faut pouvoir le retrouver en base par son empreinte, ce qu'un hash salé empêche.
 */
export function hashSecretToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

import { z } from 'zod';

/**
 * Variables d'environnement de l'API.
 * L'application refuse de démarrer si l'une d'elles est absente ou invalide.
 * Une variable n'est ajoutée ici qu'au moment où une fonctionnalité l'utilise.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
});

export type Env = z.infer<typeof envSchema>;

/** Utilisée par ConfigModule au démarrage : lève une erreur lisible si l'env est invalide. */
export function validateEnv(rawEnv: Record<string, unknown>): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    throw new Error(`Configuration invalide :\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}

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
  // Signe les access tokens : quiconque le connaît peut fabriquer un JWT valide
  JWT_SECRET: z.string().min(32),
  // Pub/sub du temps réel entre instances de l'API, files de jobs (BullMQ)
  REDIS_URL: z.url(),
  // Préfixe des clés Redis des files : chaque fichier de test e2e a le sien, pour ne pas
  // partager ses jobs avec le worker de dev ni avec les autres suites
  QUEUE_PREFIX: z.string().min(1).default('deskflow'),
  // Stockage S3 des pièces jointes (SeaweedFS en local, S3 / R2 en production)
  S3_ENDPOINT: z.url(),
  // Adresse du stockage vue par le navigateur, signée dans les URL présignées
  // (en local : localhost, alors que l'API le joint par le réseau Docker)
  S3_PUBLIC_URL: z.url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  // Serveur d'envoi des e-mails : Mailpit en développement
  SMTP_URL: z.url(),
  // Adresse du front, pour les liens envoyés par e-mail
  WEB_URL: z.url(),
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

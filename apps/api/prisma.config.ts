import { defineConfig } from 'prisma/config';

// Les variables d'environnement sont injectées par Docker Compose (env_file: .env)
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Pas de env('DATABASE_URL') : il lève une erreur si la variable manque, ce qui
    // casserait `prisma generate` (postinstall) en CI, où aucune base n'est requise.
    // Les commandes qui touchent la base échouent quand même si l'URL est vide.
    url: process.env.DATABASE_URL ?? '',
  },
});

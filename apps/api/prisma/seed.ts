// Données de démonstration : `bin/pnpm db:seed` (détail dans demo-data.ts et demo-seed.ts)
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { DEMO_PASSWORD, seedDemo } from './demo-seed.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  for (const { slug, users, ticketsCreated } of await seedDemo(prisma)) {
    const tickets = ticketsCreated > 0 ? `${ticketsCreated} tickets créés` : 'tickets déjà présents, conservés';
    console.log(`Seed OK : "${slug}", ${users} comptes (mot de passe : ${DEMO_PASSWORD}), ${tickets}`);
  }
} finally {
  await prisma.$disconnect();
}

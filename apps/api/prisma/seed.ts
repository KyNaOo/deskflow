// Données de démonstration : `bin/pnpm db:seed`
// Idempotent : peut être relancé sans créer de doublons.
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

const DEMO_PASSWORD = 'password';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme' },
    update: {},
    create: { name: 'Acme Corp', slug: 'acme' },
  });

  const passwordHash = await hash(DEMO_PASSWORD);
  const users = [
    { email: 'admin@acme.test', name: 'Alice Admin', role: Role.ADMIN },
    { email: 'agent@acme.test', name: 'Bob Agent', role: Role.AGENT },
    { email: 'client@acme.test', name: 'Chloé Client', role: Role.CUSTOMER },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: user.email } },
      update: {},
      create: { ...user, tenantId: tenant.id, passwordHash },
    });
  }

  console.log(`Seed OK : tenant "${tenant.slug}" + ${users.length} utilisateurs (mot de passe : ${DEMO_PASSWORD})`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}

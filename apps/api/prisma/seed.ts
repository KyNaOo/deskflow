// Données de démonstration : `bin/pnpm db:seed`
// Idempotent : peut être relancé sans créer de doublons.
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, TicketPriority, TicketStatus } from '../src/generated/prisma/client.js';

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

  const created = [];
  for (const user of users) {
    created.push(
      await prisma.user.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: user.email } },
        update: {},
        create: { ...user, tenantId: tenant.id, passwordHash },
      }),
    );
  }
  const [, agent, customer] = created;

  const tickets = [
    { subject: 'Impossible de me connecter à mon compte', priority: TicketPriority.HIGH, status: TicketStatus.OPEN },
    { subject: 'Facture du mois de septembre introuvable', priority: TicketPriority.MEDIUM, status: TicketStatus.PENDING, assigned: true },
    { subject: 'Problème d’impression depuis la mise à jour', priority: TicketPriority.URGENT, status: TicketStatus.OPEN, assigned: true },
    { subject: 'Comment ajouter un collègue à notre espace ?', priority: TicketPriority.LOW, status: TicketStatus.RESOLVED, assigned: true },
    { subject: 'Export CSV des données', priority: TicketPriority.MEDIUM, status: TicketStatus.CLOSED, assigned: true },
  ];

  for (const [index, ticket] of tickets.entries()) {
    const number = index + 1;
    await prisma.ticket.upsert({
      where: { tenantId_number: { tenantId: tenant.id, number } },
      update: {},
      create: {
        tenantId: tenant.id,
        number,
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        customerId: customer!.id,
        assigneeId: ticket.assigned ? agent!.id : null,
        resolvedAt: ticket.status === TicketStatus.RESOLVED ? new Date() : null,
        messages: { create: { authorId: customer!.id, body: `Bonjour, ${ticket.subject.toLowerCase()}. Merci de votre aide.` } },
      },
    });
  }
  // Les prochains tickets créés par l'application continuent la numérotation
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { ticketCounter: Math.max(tenant.ticketCounter, tickets.length) },
  });

  console.log(
    `Seed OK : tenant "${tenant.slug}", ${users.length} utilisateurs (mot de passe : ${DEMO_PASSWORD}), ${tickets.length} tickets`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}

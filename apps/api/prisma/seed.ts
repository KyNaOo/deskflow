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

  const tickets: { subject: string; priority: TicketPriority; status: TicketStatus; assigned?: boolean }[] = [
    { subject: 'Impossible de me connecter à mon compte', priority: TicketPriority.HIGH, status: TicketStatus.OPEN },
    { subject: 'Facture du mois de septembre introuvable', priority: TicketPriority.MEDIUM, status: TicketStatus.PENDING, assigned: true },
    { subject: 'Problème d’impression depuis la mise à jour', priority: TicketPriority.URGENT, status: TicketStatus.OPEN, assigned: true },
    { subject: 'Comment ajouter un collègue à notre espace ?', priority: TicketPriority.LOW, status: TicketStatus.RESOLVED, assigned: true },
    { subject: 'Export CSV des données', priority: TicketPriority.MEDIUM, status: TicketStatus.CLOSED, assigned: true },
  ];

  // Tickets supplémentaires pour remplir la liste (pagination, filtres, recherche)
  const topics = [
    'Mot de passe oublié',
    'Erreur 500 sur la page de paiement',
    'Demande de remboursement',
    'Lenteurs sur le tableau de bord',
    'Changement d’adresse de facturation',
    'Panne réseau au bureau',
    'Synchronisation du calendrier impossible',
    'Question sur l’offre Pro',
    'Notifications e-mail non reçues',
    'Bug d’affichage sur mobile',
  ];
  const statuses = [TicketStatus.OPEN, TicketStatus.OPEN, TicketStatus.PENDING, TicketStatus.RESOLVED, TicketStatus.CLOSED];
  const priorities = [TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.URGENT];
  for (let i = 0; i < 45; i++) {
    tickets.push({
      subject: `${topics[i % topics.length]} (${Math.floor(i / topics.length) + 1})`,
      status: statuses[i % statuses.length]!,
      priority: priorities[(i * 3) % priorities.length]!,
      assigned: i % 4 !== 0,
    });
  }

  const HOUR_IN_MS = 60 * 60 * 1000;
  for (const [index, ticket] of tickets.entries()) {
    const number = index + 1;
    // Dates étalées sur les derniers jours : le ticket n° 1 est le plus ancien
    const openedAt = new Date(Date.now() - (tickets.length - index) * 5 * HOUR_IN_MS);
    // Un agent a déjà répondu à tout ticket qui n'est plus OPEN
    const repliedAt = ticket.status === TicketStatus.OPEN ? null : new Date(openedAt.getTime() + HOUR_IN_MS);
    const messages = [
      { authorId: customer!.id, body: `Bonjour, ${ticket.subject.toLowerCase()}. Merci de votre aide.`, createdAt: openedAt },
    ];
    if (repliedAt) {
      messages.push({
        authorId: agent!.id,
        body: 'Bonjour, merci pour votre message. Nous regardons cela et revenons vers vous rapidement.',
        createdAt: repliedAt,
      });
    }

    await prisma.ticket.upsert({
      where: { tenantId_number: { tenantId: tenant.id, number } },
      update: {},
      create: {
        tenantId: tenant.id,
        number,
        subject: ticket.subject,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: openedAt,
        updatedAt: repliedAt ?? openedAt,
        firstResponseAt: repliedAt,
        customerId: customer!.id,
        assigneeId: ticket.assigned ? agent!.id : null,
        resolvedAt: ticket.status === TicketStatus.RESOLVED ? repliedAt : null,
        messages: { create: messages },
      },
    });
  }

  // Une note interne de démonstration, visible des agents seulement (ticket n° 3)
  const ticket3 = await prisma.ticket.findUniqueOrThrow({ where: { tenantId_number: { tenantId: tenant.id, number: 3 } } });
  const noteBody = 'Client important : lui proposer un appel si le problème persiste.';
  if (!(await prisma.message.findFirst({ where: { ticketId: ticket3.id, body: noteBody } }))) {
    await prisma.message.create({
      data: { ticketId: ticket3.id, authorId: agent!.id, body: noteBody, isInternalNote: true },
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

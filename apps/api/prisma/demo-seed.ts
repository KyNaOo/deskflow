import { hash } from '@node-rs/argon2';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { DEMO_ORGANIZATIONS, type DemoOrganization, generateTickets } from './demo-data.js';

export const DEMO_PASSWORD = 'password';

export interface SeedSummary {
  slug: string;
  users: number;
  /** Tickets créés par cette exécution (0 si l'organisation en avait déjà) */
  ticketsCreated: number;
}

/**
 * Écrit les organisations de démonstration. Idempotent : les comptes sont créés s'ils manquent,
 * et l'historique de tickets seulement si l'organisation n'a encore aucun ticket. Il est écrit en
 * une transaction : jamais d'historique à moitié créé. Pour repartir de zéro : `bin/pnpm db:reset`.
 */
export async function seedDemo(prisma: PrismaClient, now = new Date()): Promise<SeedSummary[]> {
  const passwordHash = await hash(DEMO_PASSWORD);
  const summaries: SeedSummary[] = [];
  for (const organization of DEMO_ORGANIZATIONS) {
    summaries.push(await seedOrganization(prisma, organization, passwordHash, now));
  }
  return summaries;
}

async function seedOrganization(
  prisma: PrismaClient,
  organization: DemoOrganization,
  passwordHash: string,
  now: Date,
): Promise<SeedSummary> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: organization.slug },
    update: {},
    create: { name: organization.name, slug: organization.slug },
  });

  const userIds = new Map<string, string>();
  for (const user of organization.users) {
    const { id } = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: user.email } },
      update: {},
      create: { ...user, tenantId: tenant.id, passwordHash },
    });
    userIds.set(user.email, id);
  }
  const summary = { slug: organization.slug, users: organization.users.length, ticketsCreated: 0 };

  if ((await prisma.ticket.count({ where: { tenantId: tenant.id } })) > 0) {
    return summary;
  }

  const tickets = generateTickets(organization, now);
  const idOf = (email: string) => userIds.get(email)!;
  await prisma.$transaction([
    ...tickets.map((ticket) =>
      prisma.ticket.create({
        data: {
          tenantId: tenant.id,
          number: ticket.number,
          subject: ticket.subject,
          priority: ticket.priority,
          status: ticket.status,
          customerId: idOf(ticket.customerEmail),
          assigneeId: ticket.assigneeEmail && idOf(ticket.assigneeEmail),
          createdAt: ticket.createdAt,
          // Dernière activité : celle du dernier message
          updatedAt: ticket.messages.at(-1)!.createdAt,
          firstResponseAt: ticket.firstResponseAt,
          resolvedAt: ticket.resolvedAt,
          messages: {
            create: ticket.messages.map((message) => ({
              authorId: idOf(message.authorEmail),
              body: message.body,
              createdAt: message.createdAt,
              isInternalNote: message.isInternalNote ?? false,
            })),
          },
        },
      }),
    ),
    // Les tickets créés ensuite par l'application continuent la numérotation
    prisma.tenant.update({ where: { id: tenant.id }, data: { ticketCounter: tickets.length } }),
  ]);
  return { ...summary, ticketsCreated: tickets.length };
}

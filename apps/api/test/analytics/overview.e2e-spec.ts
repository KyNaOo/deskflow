import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Role, TicketStatus } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-analytics-';
const HOUR = 3600;
const DAY = 24 * HOUR;

// Période du 27 au 31 mars 2026 : elle traverse le passage à l'heure d'été (29 mars)
const PERIOD = { from: '2026-03-27', to: '2026-03-31' };

interface TicketFixture {
  createdAt: string;
  status: TicketStatus;
  firstResponseAfter?: number;
  resolvedAfter?: number;
}

describe('Indicateurs — GET /analytics/overview (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminA: TestAccount;
  let adminB: TestAccount;
  let agentA: TestAccount;
  let customerA: TestAccount;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    adminA = await registerTenant(app, SLUG_PREFIX);
    agentA = await createAccount(app, adminA.tenantId, Role.AGENT);
    customerA = await createAccount(app, adminA.tenantId, Role.CUSTOMER);
    adminB = await registerTenant(app, SLUG_PREFIX);
    const customerB = await createAccount(app, adminB.tenantId, Role.CUSTOMER);

    await createTickets(customerA, [
      // Réponse en 1 h, résolu en 1 jour
      { createdAt: '2026-03-27T09:00:00Z', status: TicketStatus.CLOSED, firstResponseAfter: HOUR, resolvedAfter: DAY },
      // Réponse en 3 h, résolu en 3 jours
      { createdAt: '2026-03-27T10:00:00Z', status: TicketStatus.RESOLVED, firstResponseAfter: 3 * HOUR, resolvedAfter: 3 * DAY },
      // 23 h 30 UTC le 28 = 0 h 30 à Paris le 29 : compte pour le 29. Réponse en 2 h
      { createdAt: '2026-03-28T23:30:00Z', status: TicketStatus.PENDING, firstResponseAfter: 2 * HOUR },
      // Toujours sans réponse
      { createdAt: '2026-03-31T12:00:00Z', status: TicketStatus.OPEN },
      // Hors période (avant, après) : n'entrent que dans la répartition par statut
      { createdAt: '2026-03-26T12:00:00Z', status: TicketStatus.PENDING, firstResponseAfter: 100 * HOUR },
      { createdAt: '2026-04-01T08:00:00Z', status: TicketStatus.OPEN },
    ]);
    // Autre tenant, même période, délais très différents : ne doit rien changer pour A
    await createTickets(customerB, [
      { createdAt: '2026-03-27T09:00:00Z', status: TicketStatus.RESOLVED, firstResponseAfter: 1, resolvedAfter: 2 },
    ]);
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  async function createTickets(customer: TestAccount, fixtures: TicketFixture[]) {
    const after = (start: Date, seconds?: number) =>
      seconds === undefined ? null : new Date(start.getTime() + seconds * 1000);

    await prisma.ticket.createMany({
      data: fixtures.map(({ createdAt, status, firstResponseAfter, resolvedAfter }, index) => {
        const created = new Date(createdAt);
        return {
          tenantId: customer.tenantId,
          number: index + 1,
          subject: `Ticket ${index + 1}`,
          customerId: customer.id,
          status,
          createdAt: created,
          firstResponseAt: after(created, firstResponseAfter),
          resolvedAt: after(created, resolvedAfter),
        };
      }),
    });
  }

  function overview(account: TestAccount, query: Record<string, string> = PERIOD) {
    return request(app.getHttpServer())
      .get('/analytics/overview')
      .query(query)
      .set('Cookie', account.cookie);
  }

  it('calcule les indicateurs des tickets créés dans la période', async () => {
    const { body } = await overview(adminA).expect(200);

    expect(body).toEqual({
      period: PERIOD,
      ticketsCreated: 4,
      unanswered: 1,
      // Médiane de 1 h, 2 h et 3 h
      medianFirstResponseSeconds: 2 * HOUR,
      // Médiane de 1 et 3 jours
      medianResolutionSeconds: 2 * DAY,
      createdPerDay: [
        { day: '2026-03-27', count: 2 },
        { day: '2026-03-28', count: 0 },
        { day: '2026-03-29', count: 1 },
        { day: '2026-03-30', count: 0 },
        { day: '2026-03-31', count: 1 },
      ],
      // Tous les tickets du tenant, quelle que soit leur date
      byStatus: { OPEN: 2, PENDING: 2, RESOLVED: 1, CLOSED: 1 },
    });
  });

  it('n’inclut jamais les tickets d’un autre tenant', async () => {
    const { body } = await overview(adminB).expect(200);

    expect(body).toMatchObject({
      ticketsCreated: 1,
      medianFirstResponseSeconds: 1,
      medianResolutionSeconds: 2,
      byStatus: { OPEN: 0, PENDING: 0, RESOLVED: 1, CLOSED: 0 },
    });
  });

  it('renvoie des médianes nulles et des zéros sur une période sans ticket', async () => {
    const { body } = await overview(adminA, { from: '2026-01-01', to: '2026-01-03' }).expect(200);

    expect(body).toMatchObject({
      ticketsCreated: 0,
      unanswered: 0,
      medianFirstResponseSeconds: null,
      medianResolutionSeconds: null,
      createdPerDay: [
        { day: '2026-01-01', count: 0 },
        { day: '2026-01-02', count: 0 },
        { day: '2026-01-03', count: 0 },
      ],
    });
  });

  it('couvre les 30 derniers jours par défaut', async () => {
    const { body } = await overview(adminA, {}).expect(200);

    expect(body.createdPerDay).toHaveLength(30);
    expect(body.period.to).toBe(body.createdPerDay.at(-1).day);
  });

  it('refuse une période invalide (400)', async () => {
    const response = await overview(adminA, { from: '2026-03-31', to: '2026-03-01' }).expect(400);

    expect(response.body.message).toEqual(['from : La date de début doit précéder la date de fin']);
  });

  it.each([
    ['un agent', () => agentA],
    ['un client', () => customerA],
  ])('est réservé aux admins : 403 pour %s', async (_role, account) => {
    await overview(account()).expect(403);
  });
});

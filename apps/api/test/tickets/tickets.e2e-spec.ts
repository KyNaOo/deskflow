import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-tickets-';

describe('Tickets — POST /tickets et GET /tickets/:number (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  // Tenant A : un agent et deux clients ; tenant B : un agent et un client
  let agentA: TestAccount;
  let customerA: TestAccount;
  let otherCustomerA: TestAccount;
  let agentB: TestAccount;
  let customerB: TestAccount;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const adminA = await registerTenant(app, SLUG_PREFIX);
    agentA = await createAccount(app, adminA.tenantId, Role.AGENT);
    customerA = await createAccount(app, adminA.tenantId, Role.CUSTOMER);
    otherCustomerA = await createAccount(app, adminA.tenantId, Role.CUSTOMER);

    const adminB = await registerTenant(app, SLUG_PREFIX);
    agentB = await createAccount(app, adminB.tenantId, Role.AGENT);
    customerB = await createAccount(app, adminB.tenantId, Role.CUSTOMER);
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  function createTicket(account: TestAccount, body: object) {
    return request(app.getHttpServer()).post('/tickets').set('Cookie', account.cookie).send(body);
  }

  function getTicket(account: TestAccount, number: number | string) {
    return request(app.getHttpServer()).get(`/tickets/${number}`).set('Cookie', account.cookie);
  }

  describe('création', () => {
    it('un client ouvre un ticket : numéro 1, statut OPEN, description en premier message', async () => {
      const response = await createTicket(customerA, {
        subject: 'Imprimante HS',
        message: 'Elle ne répond plus depuis ce matin',
      }).expect(201);

      expect(response.body).toMatchObject({
        number: 1,
        subject: 'Imprimante HS',
        status: 'OPEN',
        priority: 'MEDIUM',
        customer: { id: customerA.id },
        assignee: null,
        firstResponseAt: null,
      });
      const messages = await prisma.message.findMany({ where: { ticketId: response.body.id } });
      expect(messages).toEqual([
        expect.objectContaining({
          authorId: customerA.id,
          body: 'Elle ne répond plus depuis ce matin',
          isInternalNote: false,
        }),
      ]);
    });

    it('un client ne peut pas ouvrir un ticket pour quelqu’un d’autre (400)', async () => {
      await createTicket(customerA, {
        subject: 'Usurpation',
        message: 'x',
        customerId: otherCustomerA.id,
      }).expect(400);
    });

    it('un agent ouvre un ticket pour un client de son organisation', async () => {
      const response = await createTicket(agentA, {
        subject: 'Appel téléphonique',
        message: 'Le client signale une panne réseau',
        priority: 'HIGH',
        customerId: customerA.id,
      }).expect(201);

      expect(response.body).toMatchObject({ priority: 'HIGH', customer: { id: customerA.id } });
    });

    it.each([
      ['sans client', undefined],
      ['pour un agent', 'agentA'],
      ['pour un client d’un autre tenant', 'customerB'],
    ] as const)('un agent ne peut pas ouvrir un ticket %s (400)', async (_case, target) => {
      const customerId = target && { agentA, customerB }[target].id;

      await createTicket(agentA, { subject: 'Sujet', message: 'x', customerId }).expect(400);
    });
  });

  describe('numérotation', () => {
    it('20 créations simultanées reçoivent les numéros suivants, sans trou ni doublon', async () => {
      const admin = await registerTenant(app, SLUG_PREFIX);
      const customer = await createAccount(app, admin.tenantId, Role.CUSTOMER);

      const responses = await Promise.all(
        Array.from({ length: 20 }, (_, i) => createTicket(customer, { subject: `Ticket ${i}`, message: 'x' })),
      );

      expect(responses.map((response) => response.status)).toEqual(Array(20).fill(201));
      const numbers = responses.map((response) => response.body.number as number).sort((a, b) => a - b);
      expect(numbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    });

    it('chaque tenant a sa propre séquence', async () => {
      const response = await createTicket(customerB, { subject: 'Premier ticket de B', message: 'x' }).expect(201);

      expect(response.body.number).toBe(1);
    });
  });

  describe('lecture', () => {
    it('un agent lit un ticket de son organisation par son numéro', async () => {
      const response = await getTicket(agentA, 1).expect(200);

      expect(response.body).toMatchObject({ number: 1, subject: 'Imprimante HS' });
    });

    it('test obligatoire : un agent du tenant A ne peut pas lire un ticket du tenant B', async () => {
      // B a maintenant un ticket n° 2 qui n'existe pas dans A, et chacun a son propre n° 1
      await createTicket(customerB, { subject: 'Deuxième ticket de B', message: 'x' }).expect(201);
      await prisma.ticket.deleteMany({ where: { tenantId: customerA.tenantId, number: 2 } });

      await getTicket(agentA, 2).expect(404);
      expect((await getTicket(agentA, 1).expect(200)).body.subject).toBe('Imprimante HS');
      expect((await getTicket(agentB, 1).expect(200)).body.subject).toBe('Premier ticket de B');
    });

    it('un client lit ses propres tickets, pas ceux d’un autre client (404)', async () => {
      await getTicket(customerA, 1).expect(200);
      await getTicket(otherCustomerA, 1).expect(404);
    });

    it.each(['0', '-1', 'abc', '99999999999'])('refuse le numéro %s (400)', async (number) => {
      await getTicket(agentA, number).expect(400);
    });

    it('exige une session (401)', async () => {
      await request(app.getHttpServer()).get('/tickets/1').expect(401);
    });
  });
});

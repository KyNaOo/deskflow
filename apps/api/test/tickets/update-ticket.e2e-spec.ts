import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-update-ticket-';

describe('PATCH /tickets/:number — statut, priorité, assignation (e2e)', () => {
  let app: INestApplication<App>;
  let admin: TestAccount;
  let agent: TestAccount;
  let customer: TestAccount;
  let otherTenantAgent: TestAccount;

  beforeAll(async () => {
    app = await createTestApp();
    admin = await registerTenant(app, SLUG_PREFIX);
    agent = await createAccount(app, admin.tenantId, Role.AGENT);
    customer = await createAccount(app, admin.tenantId, Role.CUSTOMER);
    const otherAdmin = await registerTenant(app, SLUG_PREFIX);
    otherTenantAgent = await createAccount(app, otherAdmin.tenantId, Role.AGENT);
  });

  afterAll(async () => {
    await app.get(PrismaService).tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  /** Nouveau ticket OPEN, indépendant des autres tests ; renvoie son numéro. */
  async function openTicket(): Promise<number> {
    const response = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', customer.cookie)
      .send({ subject: 'Ticket de test', message: 'x' })
      .expect(201);
    return response.body.number;
  }

  function patch(number: number, body: object, account = agent) {
    return request(app.getHttpServer())
      .patch(`/tickets/${number}`)
      .set('Cookie', account.cookie)
      .send(body);
  }

  describe('statut', () => {
    it('applique une transition autorisée', async () => {
      const number = await openTicket();

      const response = await patch(number, { status: 'PENDING' }).expect(200);

      expect(response.body).toMatchObject({ number, status: 'PENDING', resolvedAt: null });
    });

    it('pose resolvedAt à la résolution, l’efface à la réouverture', async () => {
      const number = await openTicket();

      const resolved = await patch(number, { status: 'RESOLVED' }).expect(200);
      expect(resolved.body.resolvedAt).toEqual(expect.any(String));

      const reopened = await patch(number, { status: 'OPEN' }).expect(200);
      expect(reopened.body.resolvedAt).toBeNull();
    });

    it('conserve resolvedAt à la clôture, puis refuse toute transition (409)', async () => {
      const number = await openTicket();
      const { body: resolved } = await patch(number, { status: 'RESOLVED' }).expect(200);

      const closed = await patch(number, { status: 'CLOSED' }).expect(200);
      expect(closed.body.resolvedAt).toBe(resolved.resolvedAt);

      const response = await patch(number, { status: 'OPEN' }).expect(409);
      expect(response.body.message).toBe('Transition interdite : CLOSED → OPEN');
    });

    it('refuse une transition interdite par la machine à états (409)', async () => {
      const number = await openTicket();
      await patch(number, { status: 'RESOLVED' }).expect(200);

      const response = await patch(number, { status: 'PENDING' }).expect(409);
      expect(response.body.message).toBe('Transition interdite : RESOLVED → PENDING');
    });

    it('redemander le statut actuel ne change rien (200)', async () => {
      const number = await openTicket();

      await patch(number, { status: 'OPEN' }).expect(200);
    });

    it('deux agents qui changent le statut en même temps : un seul l’emporte', async () => {
      const number = await openTicket();

      const responses = await Promise.all([
        patch(number, { status: 'RESOLVED' }),
        patch(number, { status: 'PENDING' }, admin),
      ]);

      // Selon l'ordre : update conditionnel refusé, ou transition RESOLVED → PENDING interdite
      expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([200, 409]);
      const winner = responses.find((response) => response.status === 200)!;
      const { body } = await patch(number, { priority: 'LOW' }).expect(200);
      expect(body.status).toBe(winner.body.status);
    });
  });

  describe('priorité et assignation', () => {
    it('change la priorité et met à jour updatedAt', async () => {
      const number = await openTicket();
      const before = (await patch(number, { status: 'OPEN' })).body.updatedAt as string;

      const response = await patch(number, { priority: 'URGENT' }).expect(200);

      expect(response.body.priority).toBe('URGENT');
      expect(new Date(response.body.updatedAt).getTime()).toBeGreaterThan(new Date(before).getTime());
    });

    it('assigne un agent ou un admin, et désassigne avec null', async () => {
      const number = await openTicket();

      expect((await patch(number, { assigneeId: agent.id }).expect(200)).body.assignee).toMatchObject({
        id: agent.id,
      });
      expect((await patch(number, { assigneeId: admin.id }).expect(200)).body.assignee).toMatchObject({
        id: admin.id,
      });
      expect((await patch(number, { assigneeId: null }).expect(200)).body.assignee).toBeNull();
    });

    it.each(['client', 'agent d’un autre tenant'] as const)('refuse d’assigner un %s (400)', async (target) => {
      const number = await openTicket();
      const assigneeId = target === 'client' ? customer.id : otherTenantAgent.id;

      await patch(number, { assigneeId }).expect(400);
    });
  });

  describe('accès et validation', () => {
    it('un client ne peut pas modifier un ticket, même le sien (403)', async () => {
      const number = await openTicket();

      await patch(number, { status: 'CLOSED' }, customer).expect(403);
    });

    it('un agent d’un autre tenant ne trouve pas le ticket (404)', async () => {
      const number = await openTicket();

      // Ce numéro existe dans le tenant A, pas dans celui de l'agent
      await patch(number, { status: 'PENDING' }, otherTenantAgent).expect(404);
    });

    it.each([
      ['vide', {}],
      ['avec un statut inconnu', { status: 'ARCHIVED' }],
      ['avec un champ inconnu', { subject: 'Nouveau sujet' }],
    ])('refuse une modification %s (400)', async (_case, body) => {
      const number = await openTicket();

      await patch(number, body).expect(400);
    });
  });
});

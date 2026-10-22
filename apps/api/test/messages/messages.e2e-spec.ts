import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-messages-';

interface MessageItem {
  body: string;
  isInternalNote: boolean;
  author: { id: string; role: string };
}

describe('Messages et notes internes — /tickets/:number/messages (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agent: TestAccount;
  let customer: TestAccount;
  let otherCustomer: TestAccount;
  let otherTenantAgent: TestAccount;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const admin = await registerTenant(app, SLUG_PREFIX);
    agent = await createAccount(app, admin.tenantId, Role.AGENT);
    customer = await createAccount(app, admin.tenantId, Role.CUSTOMER);
    otherCustomer = await createAccount(app, admin.tenantId, Role.CUSTOMER);
    const otherAdmin = await registerTenant(app, SLUG_PREFIX);
    otherTenantAgent = await createAccount(app, otherAdmin.tenantId, Role.AGENT);
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  /** Le client ouvre un nouveau ticket ; renvoie son numéro. */
  async function openTicket(): Promise<number> {
    const { body } = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', customer.cookie)
      .send({ subject: 'Imprimante HS', message: 'Elle ne répond plus' })
      .expect(201);
    return body.number;
  }

  function post(number: number, account: TestAccount, body: object) {
    return request(app.getHttpServer())
      .post(`/tickets/${number}/messages`)
      .set('Cookie', account.cookie)
      .send(body);
  }

  async function conversation(number: number, account: TestAccount): Promise<MessageItem[]> {
    const { body } = await request(app.getHttpServer())
      .get(`/tickets/${number}/messages`)
      .set('Cookie', account.cookie)
      .expect(200);
    return body;
  }

  async function ticket(number: number) {
    const { body } = await request(app.getHttpServer())
      .get(`/tickets/${number}`)
      .set('Cookie', agent.cookie)
      .expect(200);
    return body as { status: string; firstResponseAt: string | null; resolvedAt: string | null };
  }

  function patchStatus(number: number, status: string) {
    return request(app.getHttpServer())
      .patch(`/tickets/${number}`)
      .set('Cookie', agent.cookie)
      .send({ status })
      .expect(200);
  }

  describe('conversation', () => {
    it('contient la description du ticket comme premier message, avec son auteur', async () => {
      const number = await openTicket();

      expect(await conversation(number, customer)).toEqual([
        expect.objectContaining({
          body: 'Elle ne répond plus',
          isInternalNote: false,
          author: expect.objectContaining({ id: customer.id, role: 'CUSTOMER' }),
        }),
      ]);
    });

    it('est rendue dans l’ordre chronologique', async () => {
      const number = await openTicket();
      await post(number, agent, { body: 'Avez-vous redémarré ?' }).expect(201);
      await post(number, customer, { body: 'Oui, sans effet' }).expect(201);

      expect((await conversation(number, agent)).map((message) => message.body)).toEqual([
        'Elle ne répond plus',
        'Avez-vous redémarré ?',
        'Oui, sans effet',
      ]);
    });
  });

  describe('notes internes', () => {
    it('sont visibles des agents, jamais du client', async () => {
      const number = await openTicket();

      const { body: note } = await post(number, agent, {
        body: 'Client difficile, voir ticket #12',
        isInternalNote: true,
      }).expect(201);
      expect(note).toMatchObject({ isInternalNote: true, author: { id: agent.id } });

      expect((await conversation(number, agent)).map((message) => message.body)).toContain(
        'Client difficile, voir ticket #12',
      );
      const seenByCustomer = await conversation(number, customer);
      expect(seenByCustomer.map((message) => message.body)).toEqual(['Elle ne répond plus']);
      expect(JSON.stringify(seenByCustomer)).not.toContain('Client difficile');
    });

    it('ne changent ni le statut ni la date de première réponse', async () => {
      const number = await openTicket();
      await post(number, agent, { body: 'À traiter demain', isInternalNote: true }).expect(201);

      expect(await ticket(number)).toMatchObject({ status: 'OPEN', firstResponseAt: null });
    });

    it('un client ne peut pas en écrire (403)', async () => {
      const number = await openTicket();

      await post(number, customer, { body: 'Je suis une note ?', isInternalNote: true }).expect(403);
    });
  });

  describe('effets sur le ticket', () => {
    it('la première réponse publique d’un agent pose firstResponseAt et passe le ticket en PENDING', async () => {
      const number = await openTicket();

      await post(number, agent, { body: 'Nous regardons' }).expect(201);
      const afterFirst = await ticket(number);
      expect(afterFirst).toMatchObject({ status: 'PENDING', firstResponseAt: expect.any(String) });

      await post(number, agent, { body: 'Encore un détail' }).expect(201);
      expect((await ticket(number)).firstResponseAt).toBe(afterFirst.firstResponseAt);
    });

    it('la réponse du client repasse le ticket en OPEN', async () => {
      const number = await openTicket();
      await post(number, agent, { body: 'Pouvez-vous préciser ?' }).expect(201);

      await post(number, customer, { body: 'Voici les détails' }).expect(201);

      expect((await ticket(number)).status).toBe('OPEN');
    });

    it('le client qui répond à un ticket résolu le rouvre (resolvedAt effacé)', async () => {
      const number = await openTicket();
      await patchStatus(number, 'RESOLVED');

      await post(number, customer, { body: 'Le problème est revenu' }).expect(201);

      expect(await ticket(number)).toMatchObject({ status: 'OPEN', resolvedAt: null });
    });

    it('un agent qui répond à un ticket résolu ne change pas son statut', async () => {
      const number = await openTicket();
      await patchStatus(number, 'RESOLVED');

      await post(number, agent, { body: 'Bonne journée' }).expect(201);

      expect((await ticket(number)).status).toBe('RESOLVED');
    });

    it('un message fait remonter le ticket en tête de liste', async () => {
      const number = await openTicket();
      await openTicket();

      await post(number, agent, { body: 'Note', isInternalNote: true }).expect(201);

      const { body } = await request(app.getHttpServer())
        .get('/tickets')
        .set('Cookie', agent.cookie)
        .expect(200);
      expect(body.items[0].number).toBe(number);
    });

    it('refuse un message sur un ticket clos (409), la conversation reste lisible', async () => {
      const number = await openTicket();
      await patchStatus(number, 'CLOSED');

      await post(number, customer, { body: 'Encore une question' }).expect(409);
      await post(number, agent, { body: 'Note', isInternalNote: true }).expect(409);
      expect(await conversation(number, customer)).toHaveLength(1);
    });
  });

  describe('accès et validation', () => {
    it('un autre client du même tenant ne trouve pas le ticket (404)', async () => {
      const number = await openTicket();

      await request(app.getHttpServer())
        .get(`/tickets/${number}/messages`)
        .set('Cookie', otherCustomer.cookie)
        .expect(404);
      await post(number, otherCustomer, { body: 'Intrusion' }).expect(404);
    });

    it('un agent d’un autre tenant ne trouve pas le ticket (404)', async () => {
      const number = await openTicket();

      await request(app.getHttpServer())
        .get(`/tickets/${number}/messages`)
        .set('Cookie', otherTenantAgent.cookie)
        .expect(404);
      await post(number, otherTenantAgent, { body: 'Intrusion' }).expect(404);
    });

    it.each([
      ['vide', { body: '   ' }],
      // L'auteur vient du JWT : un champ qui tenterait de le choisir est refusé, pas ignoré
      ['avec un champ inconnu', { body: 'Bonjour', authorId: 'un-autre-utilisateur' }],
    ])('refuse un message %s (400)', async (_case, body) => {
      const number = await openTicket();

      await post(number, agent, body).expect(400);
    });
  });
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { appUrl, connectSocket, recordEvents, type TestSocket } from '../helpers/sockets.js';

const SLUG_PREFIX = 'e2e-multi-instance-';

/**
 * Deux instances de l'API (deux ports, même base, même Redis), comme avec
 * `docker compose up --scale api=2` : les navigateurs ne sont pas tous connectés à l'instance
 * qui traite la requête.
 */
describe('Temps réel sur plusieurs instances — adapter Redis (e2e)', () => {
  let instance1: INestApplication<App>;
  let instance2: INestApplication<App>;
  let agent: TestAccount;
  let customer: TestAccount;
  let otherTenantAgent: TestAccount;
  const sockets: TestSocket[] = [];

  beforeAll(async () => {
    [instance1, instance2] = await Promise.all([createTestApp(), createTestApp()]);
    const admin = await registerTenant(instance1, SLUG_PREFIX);
    agent = await createAccount(instance1, admin.tenantId, Role.AGENT);
    customer = await createAccount(instance1, admin.tenantId, Role.CUSTOMER);
    const otherAdmin = await registerTenant(instance1, SLUG_PREFIX);
    otherTenantAgent = await createAccount(instance1, otherAdmin.tenantId, Role.AGENT);
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.close());
  });

  afterAll(async () => {
    await instance1.get(PrismaService).tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await Promise.all([instance1.close(), instance2.close()]);
  });

  async function connect(instance: INestApplication, account: TestAccount) {
    const socket = await connectSocket(appUrl(instance), account.cookie);
    sockets.push(socket);
    return { socket, events: recordEvents(socket) };
  }

  async function openTicket(instance: INestApplication<App>) {
    const { body } = await request(instance.getHttpServer())
      .post('/tickets')
      .set('Cookie', customer.cookie)
      .send({ subject: 'Imprimante HS', message: 'Elle ne répond plus' })
      .expect(201);
    return body as { id: string; number: number };
  }

  it('un ticket créé sur l’instance 1 est reçu par un agent connecté à l’instance 2', async () => {
    const agentSide = await connect(instance2, agent);

    const ticket = await openTicket(instance1);

    expect(await agentSide.events.waitFor('ticket.created', (t) => t.id === ticket.id)).toMatchObject({
      number: ticket.number,
    });
  });

  it('un message envoyé à l’instance 2 arrive chez le client connecté à l’instance 1', async () => {
    const ticket = await openTicket(instance1);
    const customerSide = await connect(instance1, customer);
    expect(await customerSide.socket.emitWithAck('ticket.join', { ticketId: ticket.id })).toEqual({ ok: true });

    await request(instance2.getHttpServer())
      .post(`/tickets/${ticket.number}/messages`)
      .set('Cookie', agent.cookie)
      .send({ body: 'Réponse depuis l’instance 2' })
      .expect(201);

    expect(await customerSide.events.waitFor('message.created')).toMatchObject({
      ticketId: ticket.id,
      message: { body: 'Réponse depuis l’instance 2' },
    });
  });

  it('les rooms restent isolées par tenant d’une instance à l’autre', async () => {
    const otherTenantSide = await connect(instance2, otherTenantAgent);
    const agentSide = await connect(instance2, agent);

    const ticket = await openTicket(instance1);

    await agentSide.events.waitFor('ticket.created', (t) => t.id === ticket.id);
    expect(otherTenantSide.events.received).toEqual([]);
  });
});

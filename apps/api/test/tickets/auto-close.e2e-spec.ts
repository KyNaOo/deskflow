import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Role, TicketStatus } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { AUTO_CLOSE_QUEUE } from '../../src/tickets/auto-close.processor.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createTestWorker } from '../helpers/create-test-worker.js';
import { appUrl, connectSocket, recordEvents, type TestSocket } from '../helpers/sockets.js';

const SLUG_PREFIX = 'e2e-autoclose-';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe('Clôture automatique des tickets résolus (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let worker: TestingModule;
  let queue: Queue;
  let agentA: TestAccount;
  let customerA: TestAccount;
  let agentB: TestAccount;
  let customerB: TestAccount;
  const sockets: TestSocket[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const adminA = await registerTenant(app, SLUG_PREFIX);
    agentA = await createAccount(app, adminA.tenantId, Role.AGENT);
    customerA = await createAccount(app, adminA.tenantId, Role.CUSTOMER);
    const adminB = await registerTenant(app, SLUG_PREFIX);
    agentB = await createAccount(app, adminB.tenantId, Role.AGENT);
    customerB = await createAccount(app, adminB.tenantId, Role.CUSTOMER);

    worker = await createTestWorker();
    queue = worker.get(getQueueToken(AUTO_CLOSE_QUEUE));
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.close());
  });

  afterAll(async () => {
    await worker.close();
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  /** Ticket ouvert par le client, puis placé dans l'état voulu directement en base. */
  async function ticket(customer: TestAccount, status: TicketStatus, resolvedDaysAgo?: number) {
    const { body } = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', customer.cookie)
      .send({ subject: 'Imprimante HS', message: 'Elle ne répond plus' })
      .expect(201);
    const resolvedAt =
      resolvedDaysAgo === undefined ? null : new Date(Date.now() - resolvedDaysAgo * DAY_IN_MS);
    return prisma.ticket.update({ where: { id: body.id }, data: { status, resolvedAt } });
  }

  /** Exécute le job comme le ferait son planning, et renvoie sa synthèse. */
  async function runJob(): Promise<{ closed: number }> {
    const job = await queue.add('close-resolved-tickets', {});
    await vi.waitFor(async () => expect(await queue.getJobState(job.id!)).toBe('completed'), {
      timeout: 5_000,
      interval: 50,
    });
    return (await queue.getJob(job.id!))!.returnvalue;
  }

  function reload(id: string) {
    return prisma.ticket.findUniqueOrThrow({ where: { id } });
  }

  it('clôt les tickets résolus depuis plus de 7 jours, de tous les tenants, et seulement eux', async () => {
    const expiredA = await ticket(customerA, TicketStatus.RESOLVED, 8);
    const expiredB = await ticket(customerB, TicketStatus.RESOLVED, 8);
    const recent = await ticket(customerA, TicketStatus.RESOLVED, 6);
    const reopened = await ticket(customerA, TicketStatus.OPEN);
    const pending = await ticket(customerA, TicketStatus.PENDING);

    await runJob();

    for (const expired of [expiredA, expiredB]) {
      const closed = await reload(expired.id);
      expect(closed.status).toBe(TicketStatus.CLOSED);
      // Conservé pour l'indicateur de délai de résolution
      expect(closed.resolvedAt).toEqual(expired.resolvedAt);
    }
    expect(await reload(recent.id)).toEqual(recent);
    expect(await reload(reopened.id)).toEqual(reopened);
    expect(await reload(pending.id)).toEqual(pending);
  });

  it('une seconde exécution est sans effet', async () => {
    const expired = await ticket(customerA, TicketStatus.RESOLVED, 10);
    await runJob();
    const closed = await reload(expired.id);

    expect(await runJob()).toEqual({ closed: 0 });
    expect(await reload(expired.id)).toEqual(closed);
  });

  it('les navigateurs connectés à l’API reçoivent ticket.updated, chacun pour son tenant', async () => {
    const expiredA = await ticket(customerA, TicketStatus.RESOLVED, 8);
    const expiredB = await ticket(customerB, TicketStatus.RESOLVED, 8);
    const socketA = await connectSocket(appUrl(app), agentA.cookie);
    const socketB = await connectSocket(appUrl(app), agentB.cookie);
    sockets.push(socketA, socketB);
    const eventsA = recordEvents(socketA);
    const eventsB = recordEvents(socketB);

    await runJob();

    const updated = await eventsA.waitFor('ticket.updated', (payload) => payload.id === expiredA.id);
    expect(updated).toMatchObject({ id: expiredA.id, number: expiredA.number, status: 'CLOSED' });
    expect(updated).not.toHaveProperty('tenantId');
    await eventsB.waitFor('ticket.updated', (payload) => payload.id === expiredB.id);
    expect(eventsA.received.map(({ payload }) => payload.id)).not.toContain(expiredB.id);
  });

  it('le planning est unique, même avec plusieurs workers', async () => {
    const secondWorker = await createTestWorker();
    try {
      const schedulers = await queue.getJobSchedulers();

      expect(schedulers).toEqual([
        expect.objectContaining({ key: 'auto-close-tickets-hourly', pattern: '0 * * * *' }),
      ]);
    } finally {
      await secondWorker.close();
    }
  });
});

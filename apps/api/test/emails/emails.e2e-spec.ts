import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types.js';
import type { MockInstance } from 'vitest';
import { EMAILS_QUEUE } from '../../src/emails/emails.queue.js';
import { EmailsService } from '../../src/emails/emails.service.js';
import { Role } from '../../src/generated/prisma/client.js';
import { MailService, type MailMessage } from '../../src/mail/mail.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createTestWorker } from '../helpers/create-test-worker.js';

const SLUG_PREFIX = 'e2e-emails-';

const message: MailMessage = { to: 'client@acme.test', subject: '[#1] Test', text: 'Bonjour' };

describe('File emails (e2e)', () => {
  let app: INestApplication<App>;
  let emails: Queue<MailMessage>;
  let tenantSlug: string;
  let agent: TestAccount;
  let customer: TestAccount;
  let customerEmail: string;

  beforeAll(async () => {
    app = await createTestApp();
    emails = app.get(getQueueToken(EMAILS_QUEUE));
    const admin = await registerTenant(app, SLUG_PREFIX);
    agent = await createAccount(app, admin.tenantId, Role.AGENT);
    customer = await createAccount(app, admin.tenantId, Role.CUSTOMER);

    const prisma = app.get(PrismaService);
    tenantSlug = (await prisma.tenant.findUniqueOrThrow({ where: { id: admin.tenantId } })).slug;
    customerEmail = (await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).email;
  });

  afterAll(async () => {
    await app.get(PrismaService).tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  async function openTicket(): Promise<number> {
    const { body } = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', customer.cookie)
      .send({ subject: 'Imprimante HS', message: 'Elle ne répond plus' })
      .expect(201);
    return body.number;
  }

  async function post(number: number, account: TestAccount, body: object): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/tickets/${number}/messages`)
      .set('Cookie', account.cookie)
      .send(body)
      .expect(201);
    return response.body.id;
  }

  describe('côté API : ajout dans la file', () => {
    it('une réponse d’agent ajoute un e-mail pour le client du ticket', async () => {
      const number = await openTicket();

      const messageId = await post(number, agent, { body: 'Redémarrez-la, puis dites-moi.' });

      const job = await emails.getJob(`reply-${messageId}`);
      expect(job!.data).toEqual({
        to: customerEmail,
        subject: `[#${number}] Imprimante HS`,
        text: expect.stringContaining(`http://localhost:3000/portal/${tenantSlug}/tickets/${number}`),
      });
      expect(job!.data.text).toContain('> Redémarrez-la, puis dites-moi.');
    });

    it('une note interne ou un message du client n’ajoute aucun e-mail', async () => {
      const number = await openTicket();

      const noteId = await post(number, agent, { body: 'Client difficile', isInternalNote: true });
      const customerMessageId = await post(number, customer, { body: 'Toujours en panne' });

      expect(await emails.getJob(`reply-${noteId}`)).toBeUndefined();
      expect(await emails.getJob(`reply-${customerMessageId}`)).toBeUndefined();
    });

    it('un même événement ajouté deux fois ne donne qu’un seul job', async () => {
      const service = app.get(EmailsService);

      await service.send('reply-idempotence', message);
      await service.send('reply-idempotence', { ...message, text: 'Rejoué' });

      const job = await emails.getJob('reply-idempotence');
      expect(job!.data.text).toBe('Bonjour');
    });
  });

  describe('côté worker : envoi et retries', () => {
    let worker: TestingModule;
    let send: MockInstance<MailService['send']>;

    beforeEach(async () => {
      // Jobs ajoutés par les tests précédents : pas destinés à ce worker
      await emails.drain();
      worker = await createTestWorker();
      send = vi.spyOn(worker.get(MailService), 'send');
    });

    afterEach(async () => {
      await worker.close();
    });

    /** Ajoute un e-mail avec un backoff de 50 ms au lieu de 10 s, mêmes tentatives que la file. */
    function addWithShortBackoff(jobId: string) {
      return emails.add('send', message, { jobId, backoff: { type: 'fixed', delay: 50 } });
    }

    async function waitForState(jobId: string, state: string) {
      await vi.waitFor(async () => expect(await emails.getJobState(jobId)).toBe(state), {
        timeout: 5_000,
        interval: 50,
      });
    }

    it('un envoi qui échoue est retenté, et l’e-mail n’est envoyé qu’une fois', async () => {
      send.mockRejectedValueOnce(new Error('SMTP indisponible')).mockResolvedValueOnce();

      await addWithShortBackoff('reply-retry');
      await waitForState('reply-retry', 'completed');

      expect(send).toHaveBeenCalledTimes(2);
      expect(send).toHaveBeenLastCalledWith(message);
      expect((await emails.getJob('reply-retry'))!.attemptsMade).toBe(2);
    });

    it('après 5 échecs, le job reste en échec dans Redis avec son erreur', async () => {
      send.mockRejectedValue(new Error('SMTP indisponible'));

      await addWithShortBackoff('reply-failed');
      await waitForState('reply-failed', 'failed');

      expect(send).toHaveBeenCalledTimes(5);
      expect((await emails.getJob('reply-failed'))!.failedReason).toBe('SMTP indisponible');
    });
  });
});

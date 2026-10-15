import type { AttachmentUpload } from '@deskflow/shared';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ORPHAN_CLEANUP_QUEUE } from '../../src/attachments/orphan-cleanup.processor.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { StorageService } from '../../src/storage/storage.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { createTestWorker } from '../helpers/create-test-worker.js';
import { uploadToStorage } from '../helpers/storage.js';

const SLUG_PREFIX = 'e2e-orphans-';
const CONTENT = 'Erreur 500 à 10:42\n';
const FILE = { fileName: 'erreurs.log', mimeType: 'text/plain', size: Buffer.byteLength(CONTENT) };
const HOUR_IN_MS = 60 * 60 * 1000;

describe('Nettoyage des pièces jointes orphelines (e2e, sur SeaweedFS)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let storage: StorageService;
  let worker: TestingModule;
  let queue: Queue;
  let customer: TestAccount;
  let ticketNumber: number;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    const admin = await registerTenant(app, SLUG_PREFIX);
    customer = await createAccount(app, admin.tenantId, Role.CUSTOMER);
    const { body } = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', customer.cookie)
      .send({ subject: 'Paiement refusé', message: 'Voir le journal joint' })
      .expect(201);
    ticketNumber = body.number;

    worker = await createTestWorker();
    queue = worker.get(getQueueToken(ORPHAN_CLEANUP_QUEUE));
  });

  afterAll(async () => {
    await worker.close();
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  /** Signe une pièce jointe (et l'envoie au stockage), puis antidate sa création. */
  async function attachment({ hoursAgo, upload = true }: { hoursAgo: number; upload?: boolean }) {
    const { body } = await request(app.getHttpServer())
      .post(`/tickets/${ticketNumber}/attachments`)
      .set('Cookie', customer.cookie)
      .send(FILE)
      .expect(201);
    const signed = body as AttachmentUpload;
    if (upload) {
      expect((await uploadToStorage(signed, CONTENT)).ok).toBe(true);
    }
    await backdate(signed.attachment.id, hoursAgo);
    return { id: signed.attachment.id, key: signed.upload.fields.key! };
  }

  function backdate(id: string, hoursAgo: number) {
    return prisma.attachment.update({
      where: { id },
      data: { createdAt: new Date(Date.now() - hoursAgo * HOUR_IN_MS) },
    });
  }

  function exists(id: string) {
    return prisma.attachment.findUnique({ where: { id } }).then((row) => row !== null);
  }

  /** Exécute le job comme le ferait son planning, et renvoie sa synthèse. */
  async function runJob(): Promise<{ deletedFiles: number; freedBytes: number }> {
    const job = await queue.add('delete-orphan-attachments', {});
    await vi.waitFor(async () => expect(await queue.getJobState(job.id!)).toBe('completed'), {
      timeout: 5_000,
      interval: 50,
    });
    return (await queue.getJob(job.id!))!.returnvalue;
  }

  it('supprime les orphelines de plus de 24 h, objet et ligne, et conserve les autres', async () => {
    const oldOrphan = await attachment({ hoursAgo: 25 });
    const recentOrphan = await attachment({ hoursAgo: 23 });
    // Rattachée à un message dès l'envoi, puis antidatée : ancienne, mais pas orpheline
    const attached = await attachment({ hoursAgo: 0 });
    await request(app.getHttpServer())
      .post(`/tickets/${ticketNumber}/messages`)
      .set('Cookie', customer.cookie)
      .send({ body: 'Voici le journal', attachmentIds: [attached.id] })
      .expect(201);
    await backdate(attached.id, 48);

    const result = await runJob();

    expect(await exists(oldOrphan.id)).toBe(false);
    expect(await storage.exists(oldOrphan.key)).toBe(false);
    for (const kept of [recentOrphan, attached]) {
      expect(await exists(kept.id)).toBe(true);
      expect(await storage.exists(kept.key)).toBe(true);
    }
    expect(result.deletedFiles).toBeGreaterThanOrEqual(1);
    expect(result.freedBytes).toBeGreaterThanOrEqual(FILE.size);
  });

  it('tolère un objet déjà absent du stockage (envoi jamais fait, job rejoué)', async () => {
    const neverUploaded = await attachment({ hoursAgo: 30, upload: false });
    expect(await storage.exists(neverUploaded.key)).toBe(false);

    await runJob();

    expect(await exists(neverUploaded.id)).toBe(false);
  });

  it('une seconde exécution est sans effet', async () => {
    await attachment({ hoursAgo: 25 });
    await runJob();

    expect(await runJob()).toEqual({ deletedFiles: 0, freedBytes: 0 });
  });
});

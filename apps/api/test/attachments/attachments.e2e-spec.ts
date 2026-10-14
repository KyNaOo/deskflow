import type { AttachmentUpload } from '@deskflow/shared';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-attachments-';
const CONTENT = 'Erreur 500 à 10:42\n';
const FILE = { fileName: 'erreurs.log', mimeType: 'text/plain', size: Buffer.byteLength(CONTENT) };

/** Envoi direct au stockage, comme le navigateur : champs signés, puis le fichier. */
function uploadToStorage({ upload }: AttachmentUpload, content: string, fieldOverrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries({ ...upload.fields, ...fieldOverrides })) {
    form.append(name, value);
  }
  form.append('file', new Blob([content]));
  return fetch(upload.url, { method: 'POST', body: form });
}

describe('Pièces jointes — /tickets/:number/attachments (e2e, sur SeaweedFS)', () => {
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

  async function openTicket(): Promise<number> {
    const { body } = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', customer.cookie)
      .send({ subject: 'Paiement refusé', message: 'Voir le journal joint' })
      .expect(201);
    return body.number;
  }

  function sign(number: number, account: TestAccount, file: object = FILE) {
    return request(app.getHttpServer())
      .post(`/tickets/${number}/attachments`)
      .set('Cookie', account.cookie)
      .send(file);
  }

  /** Signe et envoie un fichier ; renvoie l'identifiant de la pièce jointe. */
  async function uploaded(number: number, account: TestAccount): Promise<string> {
    const { body } = await sign(number, account).expect(201);
    expect((await uploadToStorage(body, CONTENT)).ok).toBe(true);
    return body.attachment.id;
  }

  function post(number: number, account: TestAccount, body: object) {
    return request(app.getHttpServer())
      .post(`/tickets/${number}/messages`)
      .set('Cookie', account.cookie)
      .send(body);
  }

  function download(number: number, account: TestAccount, attachmentId: string) {
    return request(app.getHttpServer())
      .get(`/tickets/${number}/attachments/${attachmentId}`)
      .set('Cookie', account.cookie);
  }

  describe('signature', () => {
    it('renvoie un formulaire présigné, sans jamais exposer les clés du stockage', async () => {
      const number = await openTicket();

      const { body } = await sign(number, customer).expect(201);

      expect(body.attachment).toEqual({ id: expect.any(String), ...FILE });
      expect(body.upload.fields).toMatchObject({ 'Content-Type': 'text/plain', Policy: expect.any(String) });
      expect(body.upload.fields.key).toMatch(/^tenants\/[0-9a-f-]+\/tickets\/[0-9a-f-]+\/[0-9a-f-]+$/);
      expect(JSON.stringify(body)).not.toContain(process.env.S3_SECRET_KEY);
    });

    it.each([
      ['trop volumineux', { ...FILE, size: 10 * 1024 * 1024 + 1 }],
      ['d’un type interdit', { ...FILE, fileName: 'page.html', mimeType: 'text/html' }],
      ['vide', { ...FILE, size: 0 }],
    ])('refuse un fichier %s avant de signer (400)', async (_case, file) => {
      const number = await openTicket();

      await sign(number, customer, file).expect(400);
    });

    it('refuse un ticket clos (409)', async () => {
      const number = await openTicket();
      await request(app.getHttpServer())
        .patch(`/tickets/${number}`)
        .set('Cookie', agent.cookie)
        .send({ status: 'CLOSED' })
        .expect(200);

      await sign(number, customer).expect(409);
    });
  });

  describe('envoi au stockage', () => {
    it('le stockage refuse un fichier plus gros que la taille signée', async () => {
      const number = await openTicket();
      const { body } = await sign(number, customer).expect(201);

      const response = await uploadToStorage(body, `${CONTENT}contenu ajouté après la signature`);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('le stockage refuse un autre type que celui signé', async () => {
      const number = await openTicket();
      const { body } = await sign(number, customer).expect(201);

      const response = await uploadToStorage(body, CONTENT, { 'Content-Type': 'text/html' });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('rattachement à un message', () => {
    it('joint le fichier au message, visible dans la conversation et téléchargeable', async () => {
      const number = await openTicket();
      const attachmentId = await uploaded(number, customer);

      const { body: message } = await post(number, customer, {
        body: 'Voici le journal',
        attachmentIds: [attachmentId],
      }).expect(201);
      expect(message.attachments).toEqual([{ id: attachmentId, ...FILE }]);

      const { body: conversation } = await request(app.getHttpServer())
        .get(`/tickets/${number}/messages`)
        .set('Cookie', agent.cookie)
        .expect(200);
      expect(conversation.at(-1).attachments).toEqual([{ id: attachmentId, ...FILE }]);

      const redirect = await download(number, agent, attachmentId).expect(302);
      const file = await fetch(redirect.headers.location!);
      expect(file.status).toBe(200);
      expect(await file.text()).toBe(CONTENT);
      expect(file.headers.get('content-disposition')).toBe(
        `attachment; filename="erreurs.log"; filename*=UTF-8''erreurs.log`,
      );
    });

    it('refuse un fichier signé mais jamais envoyé (400)', async () => {
      const number = await openTicket();
      const { body } = await sign(number, customer).expect(201);

      await post(number, customer, { body: 'Journal', attachmentIds: [body.attachment.id] }).expect(400);
    });

    it('refuse la pièce jointe d’un autre utilisateur ou déjà utilisée (400)', async () => {
      const number = await openTicket();
      const attachmentId = await uploaded(number, customer);

      await post(number, agent, { body: 'Je la prends', attachmentIds: [attachmentId] }).expect(400);
      await post(number, customer, { body: 'Journal', attachmentIds: [attachmentId] }).expect(201);
      await post(number, customer, { body: 'Encore', attachmentIds: [attachmentId] }).expect(400);
    });
  });

  describe('contrôle d’accès au téléchargement', () => {
    it('un autre client et un agent d’un autre tenant ne trouvent pas la pièce jointe (404)', async () => {
      const number = await openTicket();
      const attachmentId = await uploaded(number, customer);
      await post(number, customer, { body: 'Journal', attachmentIds: [attachmentId] }).expect(201);

      await download(number, otherCustomer, attachmentId).expect(404);
      await download(number, otherTenantAgent, attachmentId).expect(404);
      await download(number, customer, attachmentId).expect(302);
    });

    it('la pièce jointe d’une note interne est réservée aux agents', async () => {
      const number = await openTicket();
      const attachmentId = await uploaded(number, agent);
      await post(number, agent, { body: 'Capture interne', isInternalNote: true, attachmentIds: [attachmentId] }).expect(
        201,
      );

      await download(number, customer, attachmentId).expect(404);
      await download(number, agent, attachmentId).expect(302);
    });

    it('une pièce jointe pas encore rattachée à un message n’est pas lisible (404)', async () => {
      const number = await openTicket();
      const attachmentId = await uploaded(number, customer);

      await download(number, customer, attachmentId).expect(404);
    });
  });
});

import { randomUUID } from 'node:crypto';
import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE } from '../../src/auth/auth.constants.js';
import { hashSecretToken } from '../../src/auth/secret-token.js';
import { EMAILS_QUEUE } from '../../src/emails/emails.queue.js';
import { MailService, type MailMessage } from '../../src/mail/mail.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { getCookieValue } from '../helpers/cookies.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-invite-';

describe('Invitations — POST /users/invite et /auth/accept-invitation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let emails: Queue<MailMessage>;
  let admin: { tenantId: string; accessToken: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    emails = app.get(getQueueToken(EMAILS_QUEUE));

    const response = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({
        organizationName: 'Initech',
        slug: `${SLUG_PREFIX}${randomUUID().slice(0, 8)}`,
        name: 'Peter Admin',
        email: 'peter@initech.test',
        password: 'correct-horse-battery',
      })
      .expect(201);

    admin = {
      tenantId: response.body.tenant.id,
      accessToken: getCookieValue(response, ACCESS_TOKEN_COOKIE)!,
    };
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  function invite(body: object, accessToken = admin.accessToken) {
    return request(app.getHttpServer())
      .post('/users/invite')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${accessToken}`)
      .send(body);
  }

  function accept(token: string) {
    return request(app.getHttpServer())
      .post('/auth/accept-invitation')
      .send({ token, name: 'Milton Agent', password: 'red-stapler-123' });
  }

  /** E-mail confié au worker pour cette invitation (aucun worker ne tourne dans ce test). */
  async function invitationEmail(invitationId: string): Promise<MailMessage> {
    const job = await emails.getJob(`invitation-${invitationId}`);
    return job!.data;
  }

  /** Invite l'adresse donnée et renvoie le jeton lu dans le lien de l'e-mail. */
  async function inviteAndGetToken(email: string): Promise<string> {
    const response = await invite({ email, role: 'AGENT' }).expect(201);
    const { text } = await invitationEmail(response.body.id);
    return text.match(/\/invitations\/([A-Za-z0-9_-]+)/)![1]!;
  }

  it('un admin invite un agent : l’e-mail, confié au worker, contient un lien vers le front', async () => {
    const response = await invite({ email: ' Milton@Initech.test ', role: 'AGENT' }).expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      email: 'milton@initech.test',
      role: 'AGENT',
      expiresAt: expect.any(String),
    });
    expect(await invitationEmail(response.body.id)).toEqual({
      to: 'milton@initech.test',
      subject: expect.stringContaining('Initech'),
      text: expect.stringMatching(/http:\/\/localhost:3000\/invitations\/[A-Za-z0-9_-]{43}/),
    });
  });

  it('l’API n’envoie jamais d’e-mail elle-même : aucun MailService dans l’application', () => {
    expect(() => app.get(MailService)).toThrow();
  });

  it('stocke uniquement l’empreinte du jeton, valable 48 h', async () => {
    const token = await inviteAndGetToken('bill@initech.test');

    const invitation = await prisma.invitation.findUniqueOrThrow({
      where: { tokenHash: hashSecretToken(token) },
    });
    expect(invitation.tenantId).toBe(admin.tenantId);
    const hoursLeft = (invitation.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(47.9);
    expect(hoursLeft).toBeLessThanOrEqual(48);
  });

  it('refuse d’inviter un e-mail déjà membre (409), sans e-mail', async () => {
    const jobsBefore = await emails.count();

    await invite({ email: 'peter@initech.test', role: 'ADMIN' }).expect(409);

    expect(await emails.count()).toBe(jobsBefore);
  });

  it('refuse d’inviter un client (400)', async () => {
    await invite({ email: 'customer@initech.test', role: 'CUSTOMER' }).expect(400);
  });

  it('l’invité crée son compte et est connecté', async () => {
    const token = await inviteAndGetToken('samir@initech.test');

    const response = await accept(token).expect(201);

    expect(response.body.user).toEqual({
      id: expect.any(String),
      tenantId: admin.tenantId,
      name: 'Milton Agent',
      email: 'samir@initech.test',
      role: 'AGENT',
    });
    expect(getCookieValue(response, ACCESS_TOKEN_COOKIE)).toBeDefined();
  });

  it('une invitation ne peut être acceptée qu’une fois (400)', async () => {
    const token = await inviteAndGetToken('michael@initech.test');
    await accept(token).expect(201);

    const response = await accept(token).expect(400);
    expect(response.body.message).toBe('Invitation déjà utilisée');
  });

  it('refuse une invitation expirée (400)', async () => {
    const token = await inviteAndGetToken('joanna@initech.test');
    await prisma.invitation.update({
      where: { tokenHash: hashSecretToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await accept(token).expect(400);
    expect(response.body.message).toMatch(/expirée/);
  });

  it('refuse un jeton inconnu (400)', async () => {
    const response = await accept('unknown-token').expect(400);
    expect(response.body.message).toBe('Invitation introuvable');
  });

  it('un agent ne peut pas inviter (403)', async () => {
    const token = await inviteAndGetToken('lumbergh@initech.test');
    const agentToken = getCookieValue(await accept(token).expect(201), ACCESS_TOKEN_COOKIE)!;

    await invite({ email: 'someone@initech.test', role: 'AGENT' }, agentToken).expect(403);
  });
});

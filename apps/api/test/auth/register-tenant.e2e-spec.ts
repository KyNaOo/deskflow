import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../src/auth/auth.constants.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { getSetCookie } from '../helpers/cookies.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-register-';

function validBody() {
  return {
    organizationName: 'Globex',
    slug: `${SLUG_PREFIX}${randomUUID().slice(0, 8)}`,
    name: 'Grace Admin',
    email: 'grace@globex.test',
    password: 'correct-horse-battery',
  };
}

describe('POST /auth/register-tenant (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    // Plus d'inscriptions que la limite par minute : la limite est testée dans rate-limit.e2e-spec.ts
    app = await createTestApp({ rateLimit: false });
    prisma = app.get(PrismaService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    // Les utilisateurs sont supprimés en cascade avec leur tenant
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  it('crée l’organisation et son administrateur, puis le connecte', async () => {
    const body = validBody();

    const response = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send(body)
      .expect(201);

    expect(response.body).toEqual({
      tenant: { id: expect.any(String), name: 'Globex', slug: body.slug },
      user: {
        id: expect.any(String),
        tenantId: response.body.tenant.id,
        name: 'Grace Admin',
        email: body.email,
        role: 'ADMIN',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(getSetCookie(response, ACCESS_TOKEN_COOKIE)).toBeDefined();
    expect(getSetCookie(response, REFRESH_TOKEN_COOKIE)).toBeDefined();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: response.body.user.id } });
    expect(user.tenantId).toBe(response.body.tenant.id);
    expect(user.passwordHash).not.toBe(body.password);
  });

  it('normalise le slug et l’e-mail', async () => {
    const body = validBody();

    const response = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({ ...body, slug: `  ${body.slug.toUpperCase()} `, email: ' Grace@Globex.TEST ' })
      .expect(201);

    expect(response.body.tenant.slug).toBe(body.slug);
    expect(response.body.user.email).toBe('grace@globex.test');
  });

  it('refuse un slug déjà utilisé (409)', async () => {
    const body = validBody();
    await request(app.getHttpServer()).post('/auth/register-tenant').send(body).expect(201);

    await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({ ...body, email: 'other@globex.test' })
      .expect(409);

    expect(await prisma.tenant.count({ where: { slug: body.slug } })).toBe(1);
  });

  it('refuse un slug réservé par une route du front (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({ ...validBody(), slug: 'login' })
      .expect(400);

    expect(response.body.message).toContain('ce slug est réservé');
  });

  it('refuse un body invalide avec le détail des champs (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({ ...validBody(), slug: 'Pas Un Slug!', email: 'not-an-email', password: 'short' })
      .expect(400);

    const messages: string[] = response.body.message;
    expect(messages.some((m) => m.startsWith('slug'))).toBe(true);
    expect(messages.some((m) => m.startsWith('email'))).toBe(true);
    expect(messages.some((m) => m.startsWith('password'))).toBe(true);
  });

  it('refuse un champ inconnu (400)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({ ...validBody(), role: 'ADMIN' })
      .expect(400);
  });

  it('ne laisse aucune organisation orpheline si la création de l’admin échoue', async () => {
    const body = validBody();

    // On fait échouer la 2e étape de la transaction, après la création du tenant
    const runTransaction = prisma.$transaction.bind(prisma);
    vi.spyOn(prisma, '$transaction').mockImplementation(((callback: (tx: unknown) => unknown) =>
      runTransaction(async (tx) => {
        vi.spyOn(tx.user, 'create').mockRejectedValue(new Error('panne simulée'));
        return callback(tx);
      })) as never);

    await request(app.getHttpServer()).post('/auth/register-tenant').send(body).expect(500);

    expect(await prisma.tenant.count({ where: { slug: body.slug } })).toBe(0);
  });
});

import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE } from '../src/auth/auth.constants.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { UsersService } from '../src/users/users.service.js';
import { getCookieValue } from './helpers/cookies.js';
import { createTestApp } from './helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-errors-';

describe('Format d’erreur uniforme (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const response = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({
        organizationName: 'Hooli',
        slug: `${SLUG_PREFIX}${randomUUID().slice(0, 8)}`,
        name: 'Gavin',
        email: 'gavin@hooli.test',
        password: 'correct-horse-battery',
      })
      .expect(201);
    accessToken = getCookieValue(response, ACCESS_TOKEN_COOKIE)!;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.get(PrismaService).tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  function getUsers(path = '/users') {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${accessToken}`);
  }

  it('400 : liste des champs invalides et requestId identique à l’en-tête X-Request-Id', async () => {
    const response = await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: expect.arrayContaining([expect.any(String)]),
      requestId: response.headers['x-request-id'],
    });
    expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('401 : levée par un guard, même format', async () => {
    const response = await request(app.getHttpServer()).get('/users').expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Unauthorized',
      requestId: expect.any(String),
    });
  });

  it('404 : message métier conservé', async () => {
    const response = await getUsers(`/users/${randomUUID()}`).expect(404);

    expect(response.body).toMatchObject({ statusCode: 404, message: 'Utilisateur introuvable' });
  });

  it('500 : message générique, aucun détail interne', async () => {
    vi.spyOn(app.get(UsersService), 'findAll').mockRejectedValue(
      new Error('connexion à db.internal:5432 refusée'),
    );

    const response = await getUsers().expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Erreur interne du serveur',
      requestId: expect.any(String),
    });
    expect(JSON.stringify(response.body)).not.toContain('db.internal');
  });
});

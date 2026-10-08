import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE } from '../../src/auth/auth.constants.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { getCookieValue } from '../helpers/cookies.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-me-';

describe('GET /auth/me — routes protégées par défaut (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let user: { id: string; tenantId: string };
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    const response = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({
        organizationName: 'Umbrella',
        slug: `${SLUG_PREFIX}${randomUUID().slice(0, 8)}`,
        name: 'Alice',
        email: 'alice@umbrella.test',
        password: 'correct-horse-battery',
      })
      .expect(201);

    user = response.body.user;
    accessToken = getCookieValue(response, ACCESS_TOKEN_COOKIE)!;
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  function getMe(token?: string) {
    const req = request(app.getHttpServer()).get('/auth/me');
    return token ? req.set('Cookie', `${ACCESS_TOKEN_COOKIE}=${token}`) : req;
  }

  it('renvoie le profil de l’utilisateur connecté', async () => {
    const response = await getMe(accessToken).expect(200);

    expect(response.body).toEqual({
      id: user.id,
      tenantId: user.tenantId,
      name: 'Alice',
      email: 'alice@umbrella.test',
      role: 'ADMIN',
    });
  });

  it('refuse une requête sans cookie (401)', async () => {
    await getMe().expect(401);
  });

  it('refuse un JWT dont le contenu a été modifié (401)', async () => {
    // On remplace le payload par un autre (ex. rôle modifié) sans pouvoir re-signer
    const [header, , signature] = accessToken.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: user.id, tenantId: user.tenantId, role: 'ADMIN', forged: true }),
    ).toString('base64url');

    await getMe(`${header}.${forgedPayload}.${signature}`).expect(401);
  });

  it('refuse un JWT signé avec un autre secret (401)', async () => {
    const token = await jwt.signAsync(
      { sub: user.id, tenantId: user.tenantId, role: 'ADMIN' },
      { secret: 'not-the-server-secret-but-long-enough-0123456789' },
    );
    await getMe(token).expect(401);
  });

  it('refuse un JWT expiré (401)', async () => {
    const token = await jwt.signAsync(
      { sub: user.id, tenantId: user.tenantId, role: 'ADMIN' },
      { expiresIn: -1 },
    );
    await getMe(token).expect(401);
  });

  it('laisse /health accessible sans authentification', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});

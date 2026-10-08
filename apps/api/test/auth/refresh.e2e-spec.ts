import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../src/auth/auth.constants.js';
import { hashRefreshToken } from '../../src/auth/refresh-token.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { getCookieValue, getSetCookie } from '../helpers/cookies.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-refresh-';
const PASSWORD = 'correct-horse-battery';

describe('POST /auth/refresh et /auth/logout (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let credentials: { tenantSlug: string; email: string; password: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    credentials = {
      tenantSlug: `${SLUG_PREFIX}${randomUUID().slice(0, 8)}`,
      email: 'dana@soylent.test',
      password: PASSWORD,
    };
    await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({ organizationName: 'Soylent', slug: credentials.tenantSlug, name: 'Dana', email: credentials.email, password: PASSWORD })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  /** Nouvelle connexion = nouvelle famille de refresh tokens, indépendante des autres tests. */
  async function loginAndGetRefreshToken(): Promise<string> {
    const response = await request(app.getHttpServer()).post('/auth/login').send(credentials).expect(200);
    return getCookieValue(response, REFRESH_TOKEN_COOKIE)!;
  }

  function refresh(refreshToken?: string) {
    const req = request(app.getHttpServer()).post('/auth/refresh');
    return refreshToken ? req.set('Cookie', `${REFRESH_TOKEN_COOKIE}=${refreshToken}`) : req;
  }

  it('échange un refresh token valide contre une nouvelle paire de jetons', async () => {
    const firstToken = await loginAndGetRefreshToken();

    const response = await refresh(firstToken).expect(204);

    const newRefreshToken = getCookieValue(response, REFRESH_TOKEN_COOKIE);
    const newAccessToken = getCookieValue(response, ACCESS_TOKEN_COOKIE);
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toBe(firstToken);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${newAccessToken}`)
      .expect(200);
  });

  it('chaîne les jetons d’une même famille', async () => {
    const firstToken = await loginAndGetRefreshToken();
    const secondToken = getCookieValue(await refresh(firstToken).expect(204), REFRESH_TOKEN_COOKIE)!;

    const first = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashRefreshToken(firstToken) } });
    const second = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashRefreshToken(secondToken) } });

    expect(first.revokedAt).not.toBeNull();
    expect(first.replacedById).toBe(second.id);
    expect(second.familyId).toBe(first.familyId);
  });

  it('vol de jeton : réutiliser un jeton déjà utilisé révoque toute la famille', async () => {
    // L'attaquant copie le jeton de l'utilisateur…
    const stolenToken = await loginAndGetRefreshToken();
    // …l'utilisateur continue à naviguer : son jeton est renouvelé normalement
    const userToken = getCookieValue(await refresh(stolenToken).expect(204), REFRESH_TOKEN_COOKIE)!;

    // L'attaquant tente d'utiliser le jeton volé : refusé
    await refresh(stolenToken).expect(401);

    // Par précaution, le jeton légitime est révoqué aussi : seul un vrai login rouvre une session
    await refresh(userToken).expect(401);
  });

  it('n’accepte qu’une seule des requêtes qui présentent le même jeton simultanément', async () => {
    const token = await loginAndGetRefreshToken();

    const responses = await Promise.all([refresh(token), refresh(token)]);

    const statuses = responses.map((r) => r.status).sort((a, b) => a - b);
    expect(statuses).toEqual([204, 401]);
  });

  it('refuse une requête sans refresh token (401)', async () => {
    await refresh().expect(401);
  });

  it('refuse un refresh token inconnu (401)', async () => {
    await refresh('not-a-real-token').expect(401);
  });

  it('refuse un refresh token expiré (401)', async () => {
    const token = await loginAndGetRefreshToken();
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await refresh(token).expect(401);
  });

  it('déconnexion : efface les cookies et révoque le refresh token', async () => {
    const token = await loginAndGetRefreshToken();

    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', `${REFRESH_TOKEN_COOKIE}=${token}`)
      .expect(204);

    expect(getSetCookie(response, ACCESS_TOKEN_COOKIE)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(getSetCookie(response, REFRESH_TOKEN_COOKIE)).toMatch(/Path=\/auth.*Expires=Thu, 01 Jan 1970/);
    await refresh(token).expect(401);
  });

  it('déconnexion : fonctionne même sans cookie', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(204);
  });
});

import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../src/auth/auth.constants.js';
import { hashSecretToken } from '../../src/auth/secret-token.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { getCookieValue, getSetCookie } from '../helpers/cookies.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-login-';
const PASSWORD = 'correct-horse-battery';

describe('POST /auth/login (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let account: { slug: string; email: string; userId: string; tenantId: string };

  beforeAll(async () => {
    // Plus de connexions que la limite par minute : la limite est testée dans rate-limit.e2e-spec.ts
    app = await createTestApp({ rateLimit: false });
    prisma = app.get(PrismaService);

    const slug = `${SLUG_PREFIX}${randomUUID().slice(0, 8)}`;
    const email = 'hank@initech.test';
    const response = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({ organizationName: 'Initech', slug, name: 'Hank', email, password: PASSWORD })
      .expect(201);

    account = { slug, email, userId: response.body.user.id, tenantId: response.body.tenant.id };
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  function login(overrides: Partial<{ tenantSlug: string; email: string; password: string }> = {}) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantSlug: account.slug, email: account.email, password: PASSWORD, ...overrides });
  }

  it('connecte l’utilisateur et renvoie son profil', async () => {
    const response = await login().expect(200);

    expect(response.body).toEqual({
      user: {
        id: account.userId,
        tenantId: account.tenantId,
        name: 'Hank',
        email: account.email,
        role: 'ADMIN',
      },
    });
  });

  it('accepte un slug et un e-mail avec une casse différente', async () => {
    await login({ tenantSlug: account.slug.toUpperCase(), email: 'HANK@initech.test' }).expect(200);
  });

  it('pose les deux cookies avec les attributs de sécurité', async () => {
    const response = await login().expect(200);

    const accessCookie = getSetCookie(response, ACCESS_TOKEN_COOKIE);
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('SameSite=Lax');
    expect(accessCookie).toContain('Path=/;');
    expect(accessCookie).toContain('Max-Age=900');

    const refreshCookie = getSetCookie(response, REFRESH_TOKEN_COOKIE);
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=Lax');
    expect(refreshCookie).toContain('Path=/auth');
  });

  it('émet un access token JWT contenant l’utilisateur, son tenant et son rôle', async () => {
    const response = await login().expect(200);
    const accessToken = getCookieValue(response, ACCESS_TOKEN_COOKIE)!;

    const payload = await app.get(JwtService).verifyAsync(accessToken);

    expect(payload).toMatchObject({
      sub: account.userId,
      tenantId: account.tenantId,
      role: 'ADMIN',
    });
  });

  it('stocke uniquement l’empreinte du refresh token en base', async () => {
    const response = await login().expect(200);
    const refreshToken = getCookieValue(response, REFRESH_TOKEN_COOKIE)!;

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashSecretToken(refreshToken) },
    });
    expect(stored?.userId).toBe(account.userId);
    expect(await prisma.refreshToken.count({ where: { tokenHash: refreshToken } })).toBe(0);
  });

  it.each([
    ['une organisation inconnue', { tenantSlug: 'unknown-tenant' }],
    ['un e-mail inconnu', { email: 'nobody@initech.test' }],
    ['un mauvais mot de passe', { password: 'wrong-password' }],
  ])('refuse %s avec le même message (401)', async (_case, overrides) => {
    const response = await login(overrides).expect(401);

    expect(response.body.message).toBe('Identifiants invalides');
    expect(getSetCookie(response, ACCESS_TOKEN_COOKIE)).toBeUndefined();
  });
});

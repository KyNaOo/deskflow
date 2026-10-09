import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE } from '../../src/auth/auth.constants.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { TENANT_PRISMA, type TenantPrisma } from '../../src/prisma/tenant-prisma.js';
import { getCookieValue } from '../helpers/cookies.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-isolation-';

interface Account {
  user: { id: string; tenantId: string };
  accessToken: string;
}

describe('Isolation multi-tenant — GET /users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tenantA: Account;
  let tenantB: Account;

  async function registerTenant(name: string): Promise<Account> {
    const response = await request(app.getHttpServer())
      .post('/auth/register-tenant')
      .send({
        organizationName: name,
        slug: `${SLUG_PREFIX}${randomUUID().slice(0, 8)}`,
        name: `Admin ${name}`,
        email: 'admin@same-email.test', // même e-mail dans les deux tenants
        password: 'correct-horse-battery',
      })
      .expect(201);

    return {
      user: response.body.user,
      accessToken: getCookieValue(response, ACCESS_TOKEN_COOKIE)!,
    };
  }

  function get(path: string, accessToken: string) {
    return request(app.getHttpServer())
      .get(path)
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${accessToken}`);
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantA = await registerTenant('Tenant A');
    tenantB = await registerTenant('Tenant B');
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  it('ne liste que les utilisateurs du tenant de l’appelant', async () => {
    const response = await get('/users', tenantA.accessToken).expect(200);

    expect(response.body).toEqual([expect.objectContaining({ id: tenantA.user.id })]);
  });

  it('lit un utilisateur de son propre tenant', async () => {
    const response = await get(`/users/${tenantA.user.id}`, tenantA.accessToken).expect(200);

    expect(response.body).toMatchObject({ id: tenantA.user.id, tenantId: tenantA.user.tenantId });
  });

  it('répond 404 (et non 403) pour un utilisateur d’un autre tenant', async () => {
    await get(`/users/${tenantB.user.id}`, tenantA.accessToken).expect(404);
    await get(`/users/${tenantA.user.id}`, tenantB.accessToken).expect(404);
  });

  it('refuse un id qui n’est pas un UUID (400)', async () => {
    await get('/users/not-a-uuid', tenantA.accessToken).expect(400);
  });

  it('refuse l’accès aux clients (403)', async () => {
    const customer = await prisma.user.create({
      data: {
        tenantId: tenantA.user.tenantId,
        email: 'customer@tenant-a.test',
        name: 'Client A',
        passwordHash: 'unused',
        role: Role.CUSTOMER,
      },
    });
    const customerToken = await app
      .get(JwtService)
      .signAsync({ sub: customer.id, tenantId: customer.tenantId, role: customer.role });

    await get('/users', customerToken).expect(403);
  });

  it('refuse toute requête filtrée hors contexte de requête', async () => {
    const tenantPrisma = app.get<TenantPrisma>(TENANT_PRISMA);

    await expect(tenantPrisma.user.findMany()).rejects.toThrow(/hors contexte tenant/);
  });
});

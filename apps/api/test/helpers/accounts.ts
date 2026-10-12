import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE } from '../../src/auth/auth.constants.js';
import type { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { getCookieValue } from './cookies.js';

export interface TestAccount {
  id: string;
  tenantId: string;
  /** En-tête Cookie à passer à supertest : `.set('Cookie', account.cookie)` */
  cookie: string;
}

/** Crée une organisation (préfixe de slug à nettoyer en fin de suite) et renvoie son admin. */
export async function registerTenant(
  app: INestApplication<App>,
  slugPrefix: string,
): Promise<TestAccount> {
  const response = await request(app.getHttpServer())
    .post('/auth/register-tenant')
    .send({
      organizationName: `Tenant ${slugPrefix}`,
      slug: `${slugPrefix}${randomUUID().slice(0, 8)}`,
      name: 'Admin',
      email: 'admin@tenant.test',
      password: 'correct-horse-battery',
    })
    .expect(201);

  const accessToken = getCookieValue(response, ACCESS_TOKEN_COOKIE)!;
  return {
    id: response.body.user.id,
    tenantId: response.body.tenant.id,
    cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}`,
  };
}

/** Ajoute directement en base un utilisateur du rôle voulu, avec un access token valide. */
export async function createAccount(
  app: INestApplication<App>,
  tenantId: string,
  role: Role,
): Promise<TestAccount> {
  const user = await app.get(PrismaService).user.create({
    data: {
      tenantId,
      role,
      email: `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@tenant.test`,
      name: `${role} de test`,
      passwordHash: 'unused',
    },
  });
  const accessToken = await app
    .get(JwtService)
    .signAsync({ sub: user.id, tenantId: user.tenantId, role: user.role });

  return { id: user.id, tenantId, cookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}` };
}

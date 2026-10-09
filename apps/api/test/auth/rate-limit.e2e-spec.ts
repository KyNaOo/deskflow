import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AUTH_RATE_LIMIT } from '../../src/auth/auth.constants.js';
import { createTestApp } from '../helpers/create-test-app.js';

describe('Rate limiting de l’authentification (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    // Une application par test : chaque test démarre avec des compteurs vides
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('bloque la connexion après 5 tentatives par minute (429)', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ tenantSlug: 'unknown-tenant', email: 'nobody@test.dev', password: 'wrong-password' });

    for (let i = 0; i < AUTH_RATE_LIMIT.limit; i++) {
      await attempt().expect(401);
    }
    await attempt().expect(429);
  });

  it('bloque l’inscription après 5 tentatives par minute (429)', async () => {
    // Body invalide : la limite s'applique avant même la validation
    const attempt = () => request(app.getHttpServer()).post('/auth/register-tenant').send({});

    for (let i = 0; i < AUTH_RATE_LIMIT.limit; i++) {
      await attempt().expect(400);
    }
    await attempt().expect(429);
  });

  it('ne limite pas les autres routes', async () => {
    for (let i = 0; i <= AUTH_RATE_LIMIT.limit; i++) {
      await request(app.getHttpServer()).post('/auth/logout').expect(204);
    }
  });
});

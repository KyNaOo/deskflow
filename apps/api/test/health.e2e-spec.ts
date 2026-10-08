import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/create-test-app.js';

describe('GET /health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('répond 200 quand la base est joignable', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
  });

  it('répond 503 quand la base est injoignable', async () => {
    // Le ping de Terminus sur une base SQL passe par $queryRawUnsafe('SELECT 1')
    vi.spyOn(app.get(PrismaService), '$queryRawUnsafe').mockRejectedValue(
      new Error('connection refused'),
    );

    const response = await request(app.getHttpServer()).get('/health').expect(503);

    expect(response.body).toMatchObject({
      status: 'error',
      error: { database: { status: 'down' } },
    });
  });
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DEMO_PASSWORD, seedDemo } from '../../prisma/demo-seed.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp } from '../helpers/create-test-app.js';

// Les organisations de démo ne sont pas supprimées en fin de suite : ce sont celles de `db:seed`
describe('Seed de démonstration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  function countDemoData() {
    const demo = { tenant: { slug: { in: ['acme', 'globex'] } } };
    return Promise.all([prisma.user.count({ where: demo }), prisma.ticket.count({ where: demo })]);
  }

  it('rejoué, ne duplique ni les comptes ni les tickets', async () => {
    await seedDemo(prisma);
    const [users, tickets] = await countDemoData();

    const summaries = await seedDemo(prisma);

    expect(summaries.map(({ ticketsCreated }) => ticketsCreated)).toEqual([0, 0]);
    expect(await countDemoData()).toEqual([users, tickets]);
    expect(tickets).toBeGreaterThan(0);
  });

  it('les comptes de démo se connectent avec le mot de passe documenté', async () => {
    await seedDemo(prisma);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ tenantSlug: 'globex', email: 'admin@globex.test', password: DEMO_PASSWORD })
      .expect(200);
  });
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE } from '../../src/auth/auth.constants.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { getCookieValue } from '../helpers/cookies.js';
import { registerTenant } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-portal-';

describe('Portail client — POST /auth/register-customer et GET /tenants/:slug (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tenantSlug: string;

  beforeAll(async () => {
    // Plus d'inscriptions que la limite par minute : la limite est testée dans rate-limit.e2e-spec.ts
    app = await createTestApp({ rateLimit: false });
    prisma = app.get(PrismaService);
    const admin = await registerTenant(app, SLUG_PREFIX);
    tenantSlug = (await prisma.tenant.findUniqueOrThrow({ where: { id: admin.tenantId } })).slug;
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  function register(body: object) {
    return request(app.getHttpServer()).post('/auth/register-customer').send(body);
  }

  const customer = (email: string) => ({ tenantSlug, name: 'Chloé Client', email, password: 'correct-horse-battery' });

  it('crée un client dans l’organisation et le connecte', async () => {
    const response = await register({ ...customer(' Chloe@Client.TEST '), tenantSlug: tenantSlug.toUpperCase() }).expect(201);

    expect(response.body.user).toMatchObject({ email: 'chloe@client.test', role: 'CUSTOMER' });
    const cookie = `${ACCESS_TOKEN_COOKIE}=${getCookieValue(response, ACCESS_TOKEN_COOKIE)}`;

    // Connecté en tant que client : il ouvre un ticket et ne voit que les siens
    await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', cookie)
      .send({ subject: 'Ma première demande', message: 'Bonjour' })
      .expect(201);
    const { body } = await request(app.getHttpServer()).get('/tickets').set('Cookie', cookie).expect(200);
    expect(body.items.map((ticket: { subject: string }) => ticket.subject)).toEqual(['Ma première demande']);
  });

  it('refuse un e-mail déjà utilisé dans l’organisation (409)', async () => {
    await register(customer('double@client.test')).expect(201);

    const response = await register(customer('double@client.test')).expect(409);
    expect(response.body.message).toBe('Un compte existe déjà avec cet e-mail dans cette organisation');
  });

  it('refuse une organisation inconnue (404)', async () => {
    await register({ ...customer('perdu@client.test'), tenantSlug: 'organisation-inexistante' }).expect(404);
  });

  it('refuse un rôle fourni dans la requête (400) : impossible de devenir agent ou admin', async () => {
    await register({ ...customer('pirate@client.test'), role: 'ADMIN' }).expect(400);

    expect(await prisma.user.count({ where: { email: 'pirate@client.test' } })).toBe(0);
  });

  it('GET /tenants/:slug renvoie le nom public de l’organisation, sans session', async () => {
    const response = await request(app.getHttpServer()).get(`/tenants/${tenantSlug}`).expect(200);

    expect(response.body).toEqual({ name: `Tenant ${SLUG_PREFIX}`, slug: tenantSlug });
  });

  it('GET /tenants/:slug répond 404 pour une organisation inconnue', async () => {
    await request(app.getHttpServer()).get('/tenants/organisation-inexistante').expect(404);
  });
});

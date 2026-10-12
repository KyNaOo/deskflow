import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { type Prisma, Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';

const SLUG_PREFIX = 'e2e-list-tickets-';

type TicketSeed = Omit<Prisma.TicketCreateManyInput, 'tenantId' | 'number' | 'customerId'> & {
  customerId?: string;
};

interface TicketItem {
  id: string;
  number: number;
  subject: string;
  updatedAt: string;
}

describe('GET /tickets — filtres, recherche et pagination par curseur (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agent: TestAccount;
  let otherAgent: TestAccount;
  let customer: TestAccount;
  let otherCustomer: TestAccount;
  let otherTenantAgent: TestAccount;

  /** Insère des tickets directement en base, avec des dates maîtrisées. */
  async function seedTickets(tenantId: string, tickets: TicketSeed[]) {
    await prisma.ticket.createMany({
      data: tickets.map((ticket, index) => ({
        customerId: customer.id,
        ...ticket,
        tenantId,
        number: index + 1,
      })),
    });
  }

  function list(account: TestAccount, query: Record<string, string | number> = {}) {
    return request(app.getHttpServer()).get('/tickets').query(query).set('Cookie', account.cookie);
  }

  async function subjects(account: TestAccount, query: Record<string, string | number>) {
    const { body } = await list(account, query).expect(200);
    return (body.items as TicketItem[]).map((ticket) => ticket.subject).sort();
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const admin = await registerTenant(app, SLUG_PREFIX);
    agent = await createAccount(app, admin.tenantId, Role.AGENT);
    otherAgent = await createAccount(app, admin.tenantId, Role.AGENT);
    customer = await createAccount(app, admin.tenantId, Role.CUSTOMER);
    otherCustomer = await createAccount(app, admin.tenantId, Role.CUSTOMER);

    // 25 tickets « de remplissage » dont beaucoup partagent la même date (égalités à départager)
    const sameDate = new Date('2026-10-01T10:00:00.000Z');
    const filler: TicketSeed[] = Array.from({ length: 25 }, (_, i) => ({
      subject: `Demande ${i}`,
      updatedAt: i % 3 === 0 ? new Date(sameDate.getTime() - i * 60_000) : sameDate,
    }));
    await seedTickets(admin.tenantId, [
      ...filler,
      { subject: 'Problème d’impression', status: 'OPEN', priority: 'URGENT', assigneeId: agent.id },
      { subject: 'Panne réseau au bureau', status: 'PENDING', priority: 'HIGH', assigneeId: otherAgent.id },
      { subject: 'Facture introuvable', status: 'RESOLVED', priority: 'LOW' },
      { subject: 'Accès refusé', status: 'OPEN', priority: 'HIGH', customerId: otherCustomer.id },
    ]);

    // Un autre tenant dont le ticket contient les mêmes mots
    const otherAdmin = await registerTenant(app, SLUG_PREFIX);
    otherTenantAgent = await createAccount(app, otherAdmin.tenantId, Role.AGENT);
    await seedTickets(otherAdmin.tenantId, [
      { subject: 'Panne réseau chez le voisin', customerId: otherTenantAgent.id },
    ]);
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  describe('pagination par curseur', () => {
    it('parcourt toutes les pages : chaque ticket exactement une fois, dans l’ordre', async () => {
      const seen: TicketItem[] = [];
      let cursor: string | null = null;
      let pages = 0;

      do {
        const query: Record<string, string | number> = { limit: 7, ...(cursor && { cursor }) };
        const { body } = await list(agent, query).expect(200);
        seen.push(...(body.items as TicketItem[]));
        cursor = body.nextCursor;
        pages++;
      } while (cursor);

      expect(pages).toBe(5); // 29 tickets / 7 par page
      expect(seen).toHaveLength(29);
      expect(new Set(seen.map((ticket) => ticket.id)).size).toBe(29);
      // Ordre : updatedAt décroissant, puis id décroissant
      const sorted = [...seen].sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
      );
      expect(seen.map((ticket) => ticket.id)).toEqual(sorted.map((ticket) => ticket.id));
    });

    it('renvoie nextCursor = null sur la dernière page', async () => {
      const { body } = await list(agent, { limit: 50 }).expect(200);

      expect(body.items).toHaveLength(29);
      expect(body.nextCursor).toBeNull();
    });

    it('applique la taille de page par défaut (20)', async () => {
      const { body } = await list(agent).expect(200);

      expect(body.items).toHaveLength(20);
      expect(body.nextCursor).toEqual(expect.any(String));
    });
  });

  describe('filtres', () => {
    it('filtre par statut et par priorité, seuls ou combinés', async () => {
      expect(await subjects(agent, { status: 'PENDING' })).toEqual(['Panne réseau au bureau']);
      expect(await subjects(agent, { priority: 'HIGH' })).toEqual(['Accès refusé', 'Panne réseau au bureau']);
      expect(await subjects(agent, { status: 'OPEN', priority: 'HIGH' })).toEqual(['Accès refusé']);
    });

    it('filtre par assigné : moi, un agent précis, non assigné', async () => {
      expect(await subjects(agent, { assignee: 'me' })).toEqual(['Problème d’impression']);
      expect(await subjects(agent, { assignee: otherAgent.id })).toEqual(['Panne réseau au bureau']);
      const { body } = await list(agent, { assignee: 'none', limit: 50 }).expect(200);
      expect(body.items).toHaveLength(27);
    });

    it('ignore un filtre vide (« Tous »)', async () => {
      const { body } = await list(agent, { status: '', priority: '', limit: 50 }).expect(200);

      expect(body.items).toHaveLength(29);
    });

    it('un client ne voit que ses propres tickets', async () => {
      expect(await subjects(otherCustomer, {})).toEqual(['Accès refusé']);
    });
  });

  describe('recherche', () => {
    it('trouve les formes proches d’un mot (racinisation française)', async () => {
      expect(await subjects(agent, { q: 'impressions' })).toEqual(['Problème d’impression']);
      expect(await subjects(agent, { q: 'factures' })).toEqual(['Facture introuvable']);
    });

    it('ignore les accents', async () => {
      expect(await subjects(agent, { q: 'reseau' })).toEqual(['Panne réseau au bureau']);
      expect(await subjects(agent, { q: 'acces refuse' })).toEqual(['Accès refusé']);
    });

    it('trouve un ticket par son numéro', async () => {
      expect(await subjects(agent, { q: '#26' })).toEqual(['Problème d’impression']);
      expect(await subjects(agent, { q: '27' })).toEqual(['Panne réseau au bureau']);
    });

    it('se combine avec les filtres', async () => {
      expect(await subjects(agent, { q: 'panne', status: 'OPEN' })).toEqual([]);
      expect(await subjects(agent, { q: 'panne', status: 'PENDING' })).toEqual(['Panne réseau au bureau']);
    });

    it('isolation : la recherche en SQL brut ne renvoie jamais un ticket d’un autre tenant', async () => {
      expect(await subjects(agent, { q: 'voisin' })).toEqual([]);
      expect(await subjects(otherTenantAgent, { q: 'panne' })).toEqual(['Panne réseau chez le voisin']);
      expect(await subjects(otherTenantAgent, { q: 'impression' })).toEqual([]);
    });

    it('ne plante pas sur une saisie quelconque (opérateurs, guillemets)', async () => {
      await list(agent, { q: `"panne" -bureau OR ' ; DROP TABLE tickets; --` }).expect(200);
      expect(await subjects(agent, { q: '"panne réseau"' })).toEqual(['Panne réseau au bureau']);
    });
  });

  describe('validation', () => {
    it.each([
      ['un curseur invalide', { cursor: 'pas-un-curseur' }],
      ['une taille de page nulle', { limit: 0 }],
      ['une taille de page trop grande', { limit: 51 }],
      ['un statut inconnu', { status: 'ARCHIVED' }],
      ['un paramètre inconnu', { sort: 'asc' }],
    ])('refuse %s (400)', async (_case, query) => {
      await list(agent, query).expect(400);
    });

    it('exige une session (401)', async () => {
      await request(app.getHttpServer()).get('/tickets').expect(401);
    });
  });
});

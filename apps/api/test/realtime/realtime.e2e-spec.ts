import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { ACCESS_TOKEN_COOKIE } from '../../src/auth/auth.constants.js';
import { Role } from '../../src/generated/prisma/client.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createAccount, registerTenant, type TestAccount } from '../helpers/accounts.js';
import { createTestApp } from '../helpers/create-test-app.js';
import { appUrl, connectSocket, recordEvents, type TestSocket } from '../helpers/sockets.js';

const SLUG_PREFIX = 'e2e-realtime-';

describe('Temps réel — gateway Socket.io (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let url: string;
  let agent: TestAccount;
  let otherAgent: TestAccount;
  let customer: TestAccount;
  let otherCustomer: TestAccount;
  let otherTenantAgent: TestAccount;
  let otherTenantCustomer: TestAccount;
  const sockets: TestSocket[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    url = appUrl(app);
    const admin = await registerTenant(app, SLUG_PREFIX);
    agent = await createAccount(app, admin.tenantId, Role.AGENT);
    otherAgent = await createAccount(app, admin.tenantId, Role.AGENT);
    customer = await createAccount(app, admin.tenantId, Role.CUSTOMER);
    otherCustomer = await createAccount(app, admin.tenantId, Role.CUSTOMER);
    const otherAdmin = await registerTenant(app, SLUG_PREFIX);
    otherTenantAgent = await createAccount(app, otherAdmin.tenantId, Role.AGENT);
    otherTenantCustomer = await createAccount(app, otherAdmin.tenantId, Role.CUSTOMER);
  });

  afterEach(() => {
    sockets.splice(0).forEach((socket) => socket.close());
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
    await app.close();
  });

  async function connect(account: TestAccount) {
    const socket = await connectSocket(url, account.cookie);
    sockets.push(socket);
    return { socket, events: recordEvents(socket) };
  }

  async function openTicket(owner: TestAccount): Promise<{ id: string; number: number }> {
    const { body } = await request(app.getHttpServer())
      .post('/tickets')
      .set('Cookie', owner.cookie)
      .send({ subject: 'Imprimante HS', message: 'Elle ne répond plus' })
      .expect(201);
    return body;
  }

  function post(number: number, author: TestAccount, body: object) {
    return request(app.getHttpServer())
      .post(`/tickets/${number}/messages`)
      .set('Cookie', author.cookie)
      .send(body)
      .expect(201);
  }

  function join(socket: TestSocket, ticketId: string) {
    return socket.emitWithAck('ticket.join', { ticketId });
  }

  describe('handshake', () => {
    it('refuse une connexion sans cookie', async () => {
      await expect(connectSocket(url)).rejects.toThrow('Non authentifié');
    });

    it('refuse un access token invalide', async () => {
      await expect(connectSocket(url, `${ACCESS_TOKEN_COOKIE}=forged.jwt.token`)).rejects.toThrow(
        'Non authentifié',
      );
    });

    it('accepte un access token valide', async () => {
      const { socket } = await connect(agent);

      expect(socket.connected).toBe(true);
    });
  });

  describe('ticket.created', () => {
    it('est reçu par les agents du tenant, jamais par un autre tenant ni par les clients', async () => {
      const agentSide = await connect(agent);
      const customerSide = await connect(otherCustomer);
      const otherTenantSide = await connect(otherTenantAgent);

      const ticket = await openTicket(customer);
      // Émis après le précédent : une fois reçu, le premier serait forcément déjà arrivé
      const otherTenantTicket = await openTicket(otherTenantCustomer);

      expect(await agentSide.events.waitFor('ticket.created')).toMatchObject({
        id: ticket.id,
        number: ticket.number,
        status: 'OPEN',
      });
      await otherTenantSide.events.waitFor('ticket.created', (t) => t.id === otherTenantTicket.id);
      expect(otherTenantSide.events.received.map((e) => e.payload.id)).not.toContain(ticket.id);
      expect(customerSide.events.received).toEqual([]);
    });
  });

  describe('ticket.join', () => {
    it('accepte le client sur son propre ticket et un agent du tenant', async () => {
      const ticket = await openTicket(customer);
      const { socket: customerSocket } = await connect(customer);
      const { socket: agentSocket } = await connect(agent);

      expect(await join(customerSocket, ticket.id)).toEqual({ ok: true });
      expect(await join(agentSocket, ticket.id)).toEqual({ ok: true });
    });

    it('refuse le ticket d’un autre client et celui d’un autre tenant', async () => {
      const ticket = await openTicket(customer);
      const { socket: otherCustomerSocket } = await connect(otherCustomer);
      const { socket: otherTenantSocket } = await connect(otherTenantAgent);

      expect(await join(otherCustomerSocket, ticket.id)).toEqual({ ok: false, error: 'Ticket introuvable' });
      expect(await join(otherTenantSocket, ticket.id)).toEqual({ ok: false, error: 'Ticket introuvable' });
    });

    it('refuse un identifiant invalide', async () => {
      const { socket } = await connect(agent);

      expect(await join(socket, 'pas-un-uuid')).toMatchObject({ ok: false });
    });
  });

  describe('message.created', () => {
    it('une réponse d’agent arrive chez le client, avec le ticket passé en PENDING', async () => {
      const ticket = await openTicket(customer);
      const customerSide = await connect(customer);
      await join(customerSide.socket, ticket.id);

      await post(ticket.number, agent, { body: 'Avez-vous redémarré ?' });

      expect(await customerSide.events.waitFor('message.created')).toMatchObject({
        ticketId: ticket.id,
        ticketNumber: ticket.number,
        message: { body: 'Avez-vous redémarré ?', isInternalNote: false, author: { id: agent.id } },
      });
      expect(await customerSide.events.waitFor('ticket.updated')).toMatchObject({
        id: ticket.id,
        status: 'PENDING',
      });
    });

    it('une note interne arrive chez les agents du ticket, jamais chez le client', async () => {
      const ticket = await openTicket(customer);
      const customerSide = await connect(customer);
      const agentSide = await connect(otherAgent);
      await join(customerSide.socket, ticket.id);
      await join(agentSide.socket, ticket.id);

      await post(ticket.number, agent, { body: 'Client difficile', isInternalNote: true });
      await post(ticket.number, agent, { body: 'Nous regardons' });

      await agentSide.events.waitFor('message.created', (e) => e.message.body === 'Client difficile');
      await customerSide.events.waitFor('message.created', (e) => e.message.body === 'Nous regardons');
      const seenByCustomer = JSON.stringify(customerSide.events.received);
      expect(seenByCustomer).not.toContain('Client difficile');
      // Seule la réponse publique a fait bouger le ticket côté client
      expect(customerSide.events.received.map((e) => e.event)).toEqual(['message.created', 'ticket.updated']);
    });

    it('n’est plus reçu après ticket.leave', async () => {
      const ticket = await openTicket(customer);
      const customerSide = await connect(customer);
      const witness = await openTicket(customer);
      await join(customerSide.socket, ticket.id);
      customerSide.socket.emit('ticket.leave', { ticketId: ticket.id });
      // Traité après ticket.leave (même socket) : une fois acquitté, le départ est effectif
      await join(customerSide.socket, witness.id);

      await post(ticket.number, agent, { body: 'Toujours là ?' });
      // Un second ticket suivi sert de témoin d'ordre
      await post(witness.number, agent, { body: 'Témoin' });
      await customerSide.events.waitFor('message.created', (e) => e.ticketId === witness.id);
      expect(customerSide.events.received.map((e) => e.payload.ticketId ?? e.payload.id)).not.toContain(
        ticket.id,
      );
    });
  });

  describe('agent.typing', () => {
    function typing(socket: TestSocket, ticketId: string, isInternalNote = false) {
      socket.emit('agent.typing', { ticketId, isInternalNote });
    }

    /** Ticket suivi par le client, l'agent et un second agent. */
    async function followedTicket() {
      const ticket = await openTicket(customer);
      const sides = {
        agent: await connect(agent),
        otherAgent: await connect(otherAgent),
        customer: await connect(customer),
      };
      for (const side of Object.values(sides)) {
        await join(side.socket, ticket.id);
      }
      return { ticket, ...sides };
    }

    const typingEvents = (side: { events: ReturnType<typeof recordEvents> }) =>
      side.events.received.filter((e) => e.event === 'agent.typing').map((e) => e.payload);

    it('est relayé aux autres participants avec le nom de l’agent, pas à l’émetteur', async () => {
      const { ticket, agent: agentSide, otherAgent: otherAgentSide, customer: customerSide } = await followedTicket();

      typing(agentSide.socket, ticket.id);
      // Témoin : une fois l'événement du collègue reçu, le sien serait déjà arrivé
      typing(otherAgentSide.socket, ticket.id);

      const expected = { ticketId: ticket.id, agent: { id: agent.id, name: 'AGENT de test' }, isInternalNote: false };
      expect(await customerSide.events.waitFor('agent.typing')).toEqual(expected);
      expect(await otherAgentSide.events.waitFor('agent.typing')).toEqual(expected);
      await agentSide.events.waitFor('agent.typing', (e) => e.agent.id === otherAgent.id);
      expect(typingEvents(agentSide).map((e) => e.agent.id)).not.toContain(agent.id);
    });

    it('pendant une note interne, n’est relayé qu’aux agents', async () => {
      const { ticket, agent: agentSide, otherAgent: otherAgentSide, customer: customerSide } = await followedTicket();

      typing(agentSide.socket, ticket.id, true);
      typing(agentSide.socket, ticket.id, false);

      await customerSide.events.waitFor('agent.typing');
      expect(typingEvents(customerSide)).toEqual([expect.objectContaining({ isInternalNote: false })]);
      await otherAgentSide.events.waitFor('agent.typing', (e) => !e.isInternalNote);
      expect(typingEvents(otherAgentSide).map((e) => e.isInternalNote)).toEqual([true, false]);
    });

    it('est ignoré venant d’un client', async () => {
      const { ticket, agent: agentSide, otherAgent: otherAgentSide, customer: customerSide } = await followedTicket();

      typing(customerSide.socket, ticket.id);
      // Acquitté après le traitement de agent.typing (même socket) : le refus est acquis
      await join(customerSide.socket, ticket.id);
      typing(agentSide.socket, ticket.id);

      await otherAgentSide.events.waitFor('agent.typing');
      expect(typingEvents(otherAgentSide).map((e) => e.agent.id)).toEqual([agent.id]);
    });

    it('est ignoré venant d’un agent qui n’a pas rejoint le ticket', async () => {
      const ticket = await openTicket(customer);
      const customerSide = await connect(customer);
      await join(customerSide.socket, ticket.id);
      const { socket: outsider } = await connect(otherAgent);

      typing(outsider, ticket.id);
      await join(outsider, ticket.id);
      typing(outsider, ticket.id);

      await customerSide.events.waitFor('agent.typing');
      // Seul le second, émis après ticket.join, est passé
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(typingEvents(customerSide)).toHaveLength(1);
    });
  });

  describe('ticket.updated', () => {
    it('un changement par un agent est reçu par les agents du tenant et le client du ticket', async () => {
      const ticket = await openTicket(customer);
      const agentSide = await connect(otherAgent);
      const customerSide = await connect(customer);
      const otherCustomerSide = await connect(otherCustomer);
      const otherTenantSide = await connect(otherTenantAgent);
      await join(customerSide.socket, ticket.id);

      await request(app.getHttpServer())
        .patch(`/tickets/${ticket.number}`)
        .set('Cookie', agent.cookie)
        .send({ priority: 'URGENT', assigneeId: agent.id })
        .expect(200);
      const witness = await openTicket(otherTenantCustomer);

      const expected = { id: ticket.id, priority: 'URGENT', assignee: { id: agent.id } };
      expect(await agentSide.events.waitFor('ticket.updated')).toMatchObject(expected);
      expect(await customerSide.events.waitFor('ticket.updated')).toMatchObject(expected);
      await otherTenantSide.events.waitFor('ticket.created', (t) => t.id === witness.id);
      expect(otherTenantSide.events.received.map((e) => e.event)).toEqual(['ticket.created']);
      expect(otherCustomerSide.events.received).toEqual([]);
    });
  });
});

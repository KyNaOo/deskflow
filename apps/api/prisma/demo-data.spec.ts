import { Role, TicketStatus } from '../src/generated/prisma/client.js';
import { DEMO_ORGANIZATIONS, generateTickets } from './demo-data.js';

const NOW = new Date('2026-10-22T15:00:00Z');
const DAY = 24 * 3600 * 1000;
const [acme, globex] = DEMO_ORGANIZATIONS;

describe('generateTickets', () => {
  const tickets = generateTickets(acme!, NOW);

  it('est déterministe : même date, mêmes tickets', () => {
    expect(generateTickets(acme!, NOW)).toEqual(tickets);
  });

  it('numérote du plus ancien au plus récent, sur la période voulue, sans date future', () => {
    expect(tickets.map(({ number }) => number)).toEqual(tickets.map((_, index) => index + 1));
    for (const [index, ticket] of tickets.entries()) {
      expect(ticket.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(ticket.createdAt.getTime()).toBeGreaterThan(NOW.getTime() - acme!.days * DAY);
      if (index > 0) {
        expect(ticket.createdAt.getTime()).toBeGreaterThanOrEqual(tickets[index - 1]!.createdAt.getTime());
      }
    }
  });

  it('donne un statut cohérent avec les dates de chaque ticket', () => {
    for (const ticket of tickets) {
      const { status, createdAt, firstResponseAt, resolvedAt } = ticket;
      if (firstResponseAt) {
        expect(firstResponseAt.getTime()).toBeGreaterThan(createdAt.getTime());
      }
      if (resolvedAt) {
        expect(resolvedAt.getTime()).toBeGreaterThan(firstResponseAt!.getTime());
        expect(resolvedAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      }
      if (status === TicketStatus.PENDING) {
        expect(firstResponseAt).not.toBeNull();
      }
      if (status === TicketStatus.OPEN || status === TicketStatus.PENDING) {
        expect(resolvedAt).toBeNull();
      }
      if (status === TicketStatus.RESOLVED) {
        expect(NOW.getTime() - resolvedAt!.getTime()).toBeLessThanOrEqual(7 * DAY);
      }
      if (status === TicketStatus.CLOSED) {
        expect(NOW.getTime() - resolvedAt!.getTime()).toBeGreaterThan(7 * DAY);
      }
    }
  });

  it('écrit des conversations chronologiques, ouvertes par le client, répondues par un agent', () => {
    const roles = new Map(acme!.users.map(({ email, role }) => [email, role]));
    for (const ticket of tickets) {
      expect(ticket.messages[0]).toMatchObject({ authorEmail: ticket.customerEmail, createdAt: ticket.createdAt });
      expect(roles.get(ticket.customerEmail)).toBe(Role.CUSTOMER);
      if (ticket.assigneeEmail) {
        expect(roles.get(ticket.assigneeEmail)).toBe(Role.AGENT);
      }
      const times = ticket.messages.map(({ createdAt }) => createdAt.getTime());
      expect(times).toEqual(times.toSorted((a, b) => a - b));
      if (ticket.firstResponseAt) {
        expect(ticket.messages.some((message) => message.createdAt.getTime() === ticket.firstResponseAt!.getTime()))
          .toBe(true);
      }
    }
  });

  it('produit un historique varié : tous les statuts, des notes internes, plus de tickets en semaine', () => {
    const statuses = new Set(tickets.map(({ status }) => status));
    expect(statuses).toEqual(new Set(Object.values(TicketStatus)));
    expect(tickets.some(({ messages }) => messages.some(({ isInternalNote }) => isInternalNote))).toBe(true);

    const perDay = (weekend: boolean) => {
      const days = new Set<string>();
      let count = 0;
      for (const { createdAt } of tickets) {
        if ([0, 6].includes(createdAt.getUTCDay()) === weekend) {
          count++;
          days.add(createdAt.toISOString().slice(0, 10));
        }
      }
      return count / Math.max(days.size, 1);
    };
    expect(perDay(false)).toBeGreaterThan(2 * perDay(true));
    expect(tickets.length).toBeGreaterThan(200);
  });
});

describe('DEMO_ORGANIZATIONS', () => {
  it('ont chacune un admin, un agent et un client, et un même e-mail client dans les deux', () => {
    for (const organization of DEMO_ORGANIZATIONS) {
      const roles = organization.users.map(({ role }) => role);
      expect(roles).toEqual(expect.arrayContaining([Role.ADMIN, Role.AGENT, Role.CUSTOMER]));
    }
    const globexEmails = new Set(globex!.users.map(({ email }) => email));
    expect(acme!.users.filter(({ email }) => globexEmails.has(email))).toHaveLength(1);
  });
});

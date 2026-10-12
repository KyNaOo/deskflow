import type { Prisma } from '../generated/prisma/client.js';

/** Champs d'un ticket renvoyés par l'API, avec son client et son agent assigné. */
export const ticketSelect = {
  id: true,
  number: true,
  subject: true,
  status: true,
  priority: true,
  customer: { select: { id: true, name: true, email: true } },
  assignee: { select: { id: true, name: true } },
  firstResponseAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TicketSelect;

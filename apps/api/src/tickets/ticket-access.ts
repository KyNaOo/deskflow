import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { type Prisma, Role } from '../generated/prisma/client.js';

/**
 * Tickets qu'un utilisateur peut voir dans son tenant : tous pour un agent ou un admin, les siens
 * seulement pour un client. Utilisé par chaque lecture (tickets, messages) : un ticket hors de
 * portée est simplement « introuvable » (404).
 */
export function ticketAccessFilter(reader: AuthenticatedUser): Prisma.TicketWhereInput {
  return reader.role === Role.CUSTOMER ? { customerId: reader.id } : {};
}

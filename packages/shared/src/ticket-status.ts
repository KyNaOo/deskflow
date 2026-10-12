import type { TicketStatus } from './tickets.js';

/**
 * Machine à états des tickets : seul endroit où sont définies les transitions de statut.
 * L'api la fait respecter, le front s'en sert pour ne proposer que les transitions possibles.
 *
 *   OPEN ──▶ PENDING ──▶ RESOLVED ──▶ CLOSED (définitif)
 *     ▲         │            │
 *     └─────────┴────────────┘  réouverture
 *
 * Un ticket peut aussi être clos directement (doublon, spam), sauf s'il l'est déjà.
 */
export const TICKET_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  OPEN: ['PENDING', 'RESOLVED', 'CLOSED'],
  PENDING: ['OPEN', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['OPEN', 'CLOSED'],
  CLOSED: [],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_TRANSITIONS[from].includes(to);
}

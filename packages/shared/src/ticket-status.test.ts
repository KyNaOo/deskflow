import { describe, expect, it } from 'vitest';
import { canTransition } from './ticket-status.js';
import { TICKET_STATUSES, type TicketStatus } from './tickets.js';

// Table complète attendue : toute modification de la machine à états doit être voulue
const ALLOWED: ReadonlyArray<[TicketStatus, TicketStatus]> = [
  ['OPEN', 'PENDING'],
  ['OPEN', 'RESOLVED'],
  ['OPEN', 'CLOSED'],
  ['PENDING', 'OPEN'],
  ['PENDING', 'RESOLVED'],
  ['PENDING', 'CLOSED'],
  ['RESOLVED', 'OPEN'],
  ['RESOLVED', 'CLOSED'],
];

const allPairs = TICKET_STATUSES.flatMap((from) => TICKET_STATUSES.map((to) => [from, to] as const));
const isAllowed = (from: TicketStatus, to: TicketStatus) =>
  ALLOWED.some(([f, t]) => f === from && t === to);

describe('canTransition', () => {
  it.each(allPairs.filter(([from, to]) => isAllowed(from, to)))('autorise %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(allPairs.filter(([from, to]) => !isAllowed(from, to)))('interdit %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('un ticket clos ne peut plus changer de statut', () => {
    expect(TICKET_STATUSES.some((to) => canTransition('CLOSED', to))).toBe(false);
  });
});

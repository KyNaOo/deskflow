import { canTransition, type TicketStatus } from '@deskflow/shared';
import { ConflictException } from '@nestjs/common';

/**
 * Données à écrire pour passer un ticket de `from` à `to`, ou 409 si la machine à états
 * (@deskflow/shared) l'interdit. `resolvedAt` mesure le délai de résolution : posé en passant à
 * RESOLVED, effacé à la réouverture, conservé à la clôture.
 */
export function transitionData(from: TicketStatus, to: TicketStatus, now = new Date()) {
  if (!canTransition(from, to)) {
    throw new ConflictException(`Transition interdite : ${from} → ${to}`);
  }

  if (to === 'RESOLVED') {
    return { status: to, resolvedAt: now };
  }
  if (from === 'RESOLVED' && to !== 'CLOSED') {
    return { status: to, resolvedAt: null };
  }
  return { status: to };
}

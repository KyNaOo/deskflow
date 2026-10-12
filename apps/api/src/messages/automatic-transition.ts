import type { TicketStatus } from '@deskflow/shared';

export interface AutomaticTransition {
  from: TicketStatus[];
  to: TicketStatus;
}

/**
 * Statut suivant un nouveau message, qui indique qui doit agir :
 * - réponse publique d'un agent : on attend le client (OPEN → PENDING) ;
 * - réponse du client : à l'équipe de jouer, y compris s'il répond à un ticket résolu
 *   (PENDING / RESOLVED → OPEN) ;
 * - note interne : aucun changement, le client n'a rien reçu.
 * Chaque transition respecte la machine à états de @deskflow/shared (vérifié par les tests).
 */
export function automaticTransition(
  authorIsCustomer: boolean,
  isInternalNote: boolean,
): AutomaticTransition | null {
  if (isInternalNote) {
    return null;
  }
  return authorIsCustomer
    ? { from: ['PENDING', 'RESOLVED'], to: 'OPEN' }
    : { from: ['OPEN'], to: 'PENDING' };
}

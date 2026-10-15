import { Injectable } from '@nestjs/common';
import type { ServerToClientEvents } from '@deskflow/shared';
import { TenantContext } from '../common/tenant-context.js';
import { rooms } from './realtime-rooms.js';
import { RealtimeGateway } from './realtime.gateway.js';

interface TicketRef {
  id: string;
  number: number;
}

/**
 * Pousse les changements aux navigateurs concernés. Appelé par les services métier une fois
 * la transaction validée : un événement ne décrit jamais une écriture annulée.
 * Le tenant est celui de la requête en cours, jamais une valeur fournie par l'appelant.
 */
@Injectable()
export class RealtimeService {
  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly tenantContext: TenantContext,
  ) {}

  ticketCreated(ticket: { id: string }) {
    this.emit([rooms.tenantAgents(this.tenantContext.tenantId)], 'ticket.created', ticket);
  }

  ticketUpdated(ticket: { id: string }) {
    this.emit(rooms.ticketUpdated(this.tenantContext.tenantId, ticket.id), 'ticket.updated', ticket);
  }

  /** Une note interne ne part que vers la room des agents du ticket. */
  messageCreated(ticket: TicketRef, message: { isInternalNote: boolean }) {
    const room = message.isInternalNote ? rooms.ticketAgents(ticket.id) : rooms.ticket(ticket.id);
    this.emit([room], 'message.created', {
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      message,
    });
  }

  // Un socket présent dans plusieurs de ces rooms ne reçoit l'événement qu'une fois
  private emit(targets: string[], event: keyof ServerToClientEvents, payload: object) {
    this.gateway.server.to(targets).emit(event, payload);
  }
}

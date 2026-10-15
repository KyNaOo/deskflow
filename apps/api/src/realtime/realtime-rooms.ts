/**
 * Rooms Socket.io : un événement n'est envoyé qu'aux sockets d'une room, jamais à tous.
 * Les agents d'un ticket ont leur propre room pour que les notes internes ne puissent pas
 * atteindre le client, même par erreur de filtrage côté navigateur.
 */
export const rooms = {
  /** Agents et admins du tenant, rejointe à la connexion */
  tenantAgents: (tenantId: string) => `tenant:${tenantId}:agents`,
  /** Tous les participants d'un ticket (client et agents), rejointe par `ticket.join` */
  ticket: (ticketId: string) => `ticket:${ticketId}`,
  /** Agents qui suivent un ticket : notes internes */
  ticketAgents: (ticketId: string) => `ticket:${ticketId}:agents`,
  /** Destinataires de `ticket.updated` : les agents du tenant et les participants du ticket */
  ticketUpdated: (tenantId: string, ticketId: string) => [
    rooms.tenantAgents(tenantId),
    rooms.ticket(ticketId),
  ],
};

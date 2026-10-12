import { TICKET_TRANSITIONS, type TicketStatus } from "@deskflow/shared";

/** Statuts proposés pour un ticket : l'actuel, puis ceux qu'autorise la machine à états. */
export function statusOptions(current: TicketStatus): TicketStatus[] {
  return [current, ...TICKET_TRANSITIONS[current]];
}

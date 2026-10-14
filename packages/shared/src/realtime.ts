import { z } from 'zod';
import type { Attachment } from './attachments.js';
import type { Role } from './roles.js';
import type { TicketPriority, TicketStatus } from './tickets.js';

/** Ticket tel que renvoyé par l'API (REST et WebSocket) ; les dates sont en ISO 8601. */
export interface Ticket {
  id: string;
  number: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  customer: { id: string; name: string; email: string };
  assignee: { id: string; name: string } | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Message d'un ticket (GET /tickets/:number/messages, événement `message.created`) */
export interface Message {
  id: string;
  body: string;
  isInternalNote: boolean;
  aiGenerated: boolean;
  createdAt: string;
  author: { id: string; name: string; role: Role };
  attachments: Attachment[];
}

/** Un agent rédige une réponse (ou une note interne) sur un ticket. */
export interface AgentTypingEvent {
  ticketId: string;
  agent: { id: string; name: string };
  isInternalNote: boolean;
}

export interface MessageCreatedEvent {
  ticketId: string;
  ticketNumber: number;
  message: Message;
}

/** Événements poussés par le serveur, émis après l'enregistrement en base. */
export interface ServerToClientEvents {
  /** Aux agents du tenant */
  'ticket.created': (ticket: Ticket) => void;
  /** Aux agents du tenant et aux participants du ticket (statut, priorité, assignation) */
  'ticket.updated': (ticket: Ticket) => void;
  /** Aux participants du ticket ; une note interne n'est envoyée qu'aux agents */
  'message.created': (event: MessageCreatedEvent) => void;
  /** Aux autres participants du ticket ; pendant une note interne, aux agents seulement */
  'agent.typing': (event: AgentTypingEvent) => void;
}

/** Réponse (acknowledgement) du serveur à `ticket.join` */
export type JoinTicketAck = { ok: true } | { ok: false; error: string };

export const ticketRoomRequestSchema = z.strictObject({ ticketId: z.uuid() });

export type TicketRoomRequest = z.infer<typeof ticketRoomRequestSchema>;

export const agentTypingSchema = z.strictObject({ ticketId: z.uuid(), isInternalNote: z.boolean() });

export type AgentTypingRequest = z.infer<typeof agentTypingSchema>;

/** Événements envoyés par le navigateur. */
export interface ClientToServerEvents {
  /** Suivre un ticket : accepté seulement s'il est visible de l'utilisateur (même règle que REST) */
  'ticket.join': (request: TicketRoomRequest, ack: (result: JoinTicketAck) => void) => void;
  'ticket.leave': (request: TicketRoomRequest) => void;
  /** Agents uniquement, sur un ticket rejoint ; à limiter côté navigateur (~1 fois toutes les 2 s) */
  'agent.typing': (request: AgentTypingRequest) => void;
}

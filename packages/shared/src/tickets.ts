import { z } from 'zod';
import { requiredText } from './fields.js';

// Mêmes valeurs que les enums Prisma de l'api (prisma/schema.prisma)
export const TICKET_STATUSES = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES, 'Priorité invalide');

/** Message d'un ticket (premier message ou réponse) */
export const messageBody = requiredText(10_000);

export const createTicketSchema = z.strictObject({
  subject: requiredText(200),
  /** Premier message du ticket : la description du problème */
  message: messageBody,
  priority: ticketPrioritySchema.optional(),
  /** Client pour lequel un agent ouvre le ticket ; jamais fourni par un client */
  customerId: z.uuid('Identifiant de client invalide').optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

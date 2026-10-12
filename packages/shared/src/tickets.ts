import { z } from 'zod';
import { requiredText } from './fields.js';

// Mêmes valeurs que les enums Prisma de l'api (prisma/schema.prisma)
export const TICKET_STATUSES = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES, 'Priorité invalide');
export const ticketStatusSchema = z.enum(TICKET_STATUSES, 'Statut invalide');

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

/** Modification d'un ticket par un agent : au moins un champ. `assigneeId: null` désassigne. */
export const updateTicketSchema = z
  .strictObject({
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    assigneeId: z.uuid('Identifiant d’agent invalide').nullable().optional(),
  })
  .refine((update) => Object.values(update).some((value) => value !== undefined), 'Aucune modification demandée');

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

export const TICKET_PAGE_SIZE = 20;
export const MAX_TICKET_PAGE_SIZE = 50;

/** Paramètre d'URL facultatif : une valeur vide (`?status=`, filtre « Tous ») vaut « pas de filtre ». */
const urlParam = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/** Filtres de la liste des tickets (`GET /tickets?…`), lus aussi depuis l'URL par le front. */
export const listTicketsQuerySchema = z.strictObject({
  status: urlParam(ticketStatusSchema),
  priority: urlParam(ticketPrioritySchema),
  /** `me` (moi), `none` (non assigné) ou l'identifiant d'un agent */
  assignee: urlParam(
    z.union([z.literal('me'), z.literal('none'), z.uuid()], 'Assigné invalide : me, none ou un identifiant'),
  ),
  /** Recherche plein texte dans le sujet, ou numéro de ticket (`42`, `#42`) */
  q: urlParam(z.string().trim().max(100, '100 caractères maximum')),
  cursor: urlParam(z.string().max(200)),
  limit: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(1).max(MAX_TICKET_PAGE_SIZE).default(TICKET_PAGE_SIZE),
  ),
});

export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

export const createMessageSchema = z.strictObject({
  body: messageBody,
  /** Note interne : visible des agents uniquement */
  isInternalNote: z.boolean().optional(),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

import type { TicketPriority, TicketStatus } from "@deskflow/shared";

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Ouvert",
  PENDING: "En attente du client",
  RESOLVED: "Résolu",
  CLOSED: "Clos",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Basse",
  MEDIUM: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

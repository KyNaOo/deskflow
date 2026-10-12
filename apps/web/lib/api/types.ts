import type { Role, TicketPriority, TicketStatus } from "@deskflow/shared";

/** Réponse de GET /auth/me */
export interface Profile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  tenant: { name: string; slug: string };
}

/** Utilisateur de l'organisation (GET /users) */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

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

/** Réponse de GET /tickets */
export interface TicketPage {
  items: Ticket[];
  nextCursor: string | null;
}

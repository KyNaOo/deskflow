import type { Role, Ticket } from "@deskflow/shared";

// Formes partagées avec l'api (REST et WebSocket)
export type { Message, Ticket } from "@deskflow/shared";

/** Réponse de GET /auth/me */
export interface Profile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  tenant: { name: string; slug: string };
}

/** Organisation, telle qu'affichée sur son portail public (GET /tenants/:slug) */
export interface PublicTenant {
  name: string;
  slug: string;
}

/** Utilisateur de l'organisation (GET /users) */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Réponse de GET /tickets */
export interface TicketPage {
  items: Ticket[];
  nextCursor: string | null;
}

export type Role = "ADMIN" | "AGENT" | "CUSTOMER";

/** Réponse de GET /auth/me */
export interface Profile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  tenant: { name: string; slug: string };
}

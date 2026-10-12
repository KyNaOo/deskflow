import type { Role } from "@deskflow/shared";

/** Réponse de GET /auth/me */
export interface Profile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: Role;
  tenant: { name: string; slug: string };
}

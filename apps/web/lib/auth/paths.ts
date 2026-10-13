import type { Role } from "@deskflow/shared";

/** Page d'accueil selon le rôle : les clients ont leur portail, les agents et admins leur espace. */
export function homePath(role: Role, tenantSlug: string): string {
  return role === "CUSTOMER" ? `/portal/${tenantSlug}/tickets` : `/${tenantSlug}/tickets`;
}

// Pages accessibles sans session : authentification, et accueil / connexion / inscription du portail
const PUBLIC_PATH = /^\/(?:(?:login|register|refresh)\/?|invitations\/.*|portal\/[^/]+\/?(?:(?:login|register)\/?)?)$/;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH.test(pathname);
}

/**
 * Page de connexion à proposer quand la session ne peut pas être renouvelée : celle du portail
 * pour une page du portail (un client n'a pas à connaître la page de connexion des agents).
 */
export function loginPathFor(nextPath: string): string {
  const portal = /^\/portal\/([^/?#]+)/.exec(nextPath);
  return portal ? `/portal/${portal[1]}/login` : "/login";
}

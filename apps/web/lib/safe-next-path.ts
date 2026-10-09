/**
 * Chemin de retour après un refresh (`?next=`) : uniquement un chemin interne.
 * Refuse `//evil.com`, `/\evil.com` (lu `//` par les navigateurs) ou `https://…`,
 * qui feraient de la redirection une porte vers un autre site.
 */
export function safeNextPath(next: string | string[] | undefined): string {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : "/";
}

import type { ClsStore } from 'nestjs-cls';

/**
 * Contexte propre à chaque requête (AsyncLocalStorage via nestjs-cls).
 * Le tenantId y est déposé par JwtAuthGuard, depuis le JWT : jamais depuis l'URL ou le body.
 */
export interface TenantStore extends ClsStore {
  tenantId?: string;
}

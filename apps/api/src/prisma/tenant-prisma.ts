import { TenantContext } from '../common/tenant-context.js';
import { PrismaService } from './prisma.service.js';
import { scopeToTenant, TENANT_SCOPED_MODELS } from './tenant-isolation.js';

/**
 * Client Prisma filtré sur le tenant de la requête courante : celui du code métier.
 * `@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma`
 *
 * PrismaService (non filtré) reste réservé aux cas sans tenant connu à l'avance :
 * inscription, connexion, refresh, healthcheck, seed.
 */
export const TENANT_PRISMA = Symbol('TENANT_PRISMA');

export type TenantPrisma = ReturnType<typeof createTenantPrisma>;

export function createTenantPrisma(prisma: PrismaService, tenantContext: TenantContext) {
  return prisma.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }
          return query(scopeToTenant(operation, args, tenantContext.tenantId));
        },
      },
    },
  });
}

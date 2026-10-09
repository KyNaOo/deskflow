import { ClsService } from 'nestjs-cls';
import type { TenantStore } from '../common/tenant-store.js';
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

export function createTenantPrisma(prisma: PrismaService, cls: ClsService<TenantStore>) {
  return prisma.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const tenantId = cls.isActive() ? cls.get('tenantId') : undefined;
          if (!tenantId) {
            // Ex. route @Public() ou job sans contexte : on refuse plutôt que de tout lire
            throw new Error(`Requête sur ${model} hors contexte tenant`);
          }
          return query(scopeToTenant(operation, args, tenantId));
        },
      },
    },
  });
}

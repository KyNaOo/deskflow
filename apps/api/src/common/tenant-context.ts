import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import type { TenantStore } from './tenant-store.js';

/**
 * Tenant de la requête en cours, déposé par JwtAuthGuard depuis le JWT (jamais depuis l'URL
 * ou le body). Seul point d'accès à cette valeur : le client Prisma filtré s'en sert, et le
 * code métier aussi quand il doit l'écrire (création, compteur du tenant).
 * Hors requête HTTP (WebSocket, job du worker), `run` ouvre ce contexte explicitement.
 */
@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService<TenantStore>) {}

  get tenantId(): string {
    const tenantId = this.cls.isActive() ? this.cls.get('tenantId') : undefined;
    if (!tenantId) {
      // Ex. route @Public() ou job sans contexte : on refuse plutôt que de tout lire
      throw new Error('Opération hors contexte tenant : aucun tenant dans la requête en cours');
    }
    return tenantId;
  }

  /** Exécute `work` dans le contexte du tenant donné : le client Prisma filtré s'y applique. */
  run<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return this.cls.run(async () => {
      this.cls.set('tenantId', tenantId);
      // Attendu ici : une requête Prisma ne part qu'au premier await, qui doit être dans le contexte
      return await work();
    });
  }
}

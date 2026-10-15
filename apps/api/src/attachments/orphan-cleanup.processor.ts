import { InjectQueue, Processor } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobProcessor } from '../queues/job-processor.js';
import { MAX_KEYS_PER_DELETE, StorageService } from '../storage/storage.service.js';

export const ORPHAN_CLEANUP_QUEUE = 'orphan-attachments';

/**
 * Âge à partir duquel une pièce jointe jamais rattachée est abandonnée. Bien au-delà des 5 min
 * de validité du formulaire d'envoi : un message en cours de rédaction n'est jamais touché.
 */
export const ORPHAN_MAX_AGE_HOURS = 24;

interface OrphanCleanupResult {
  deletedFiles: number;
  freedBytes: number;
}

/**
 * Supprime les pièces jointes envoyées mais jamais rattachées à un message (formulaire
 * abandonné), dans le stockage puis en base. Planifié chaque nuit, tous tenants confondus.
 */
@Processor(ORPHAN_CLEANUP_QUEUE)
export class OrphanCleanupProcessor
  extends JobProcessor<unknown, OrphanCleanupResult>
  implements OnApplicationBootstrap
{
  constructor(
    @InjectQueue(ORPHAN_CLEANUP_QUEUE) private readonly queue: Queue,
    // Client non filtré, volontairement : ce job traite tous les tenants à la fois et n'agit
    // pour le compte d'aucun utilisateur (les pièces jointes n'ont pas de tenantId en propre)
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  /** Idempotent : un seul planning sous cet id, quel que soit le nombre de workers. */
  async onApplicationBootstrap() {
    await this.queue.upsertJobScheduler(
      'orphan-attachments-nightly',
      { pattern: '0 3 * * *' },
      { name: 'delete-orphan-attachments' },
    );
  }

  protected async handle(): Promise<OrphanCleanupResult> {
    const orphan = {
      messageId: null,
      createdAt: { lt: new Date(Date.now() - ORPHAN_MAX_AGE_HOURS * 60 * 60 * 1000) },
    };
    const result: OrphanCleanupResult = { deletedFiles: 0, freedBytes: 0 };

    for (;;) {
      const batch = await this.prisma.attachment.findMany({
        where: orphan,
        select: { id: true, fileKey: true, size: true },
        take: MAX_KEYS_PER_DELETE,
      });
      if (batch.length === 0) {
        return result;
      }

      // Stockage d'abord : si la base échoue ensuite, les lignes restent et le job suivant
      // retente (objet déjà absent toléré). Dans l'autre ordre, un échec du stockage laisserait
      // des fichiers que plus aucune ligne ne référence.
      await this.storage.deleteMany(batch.map(({ fileKey }) => fileKey));
      // Toujours conditionnel : une pièce jointe rattachée entre-temps n'est pas effacée
      const { count } = await this.prisma.attachment.deleteMany({
        where: { id: { in: batch.map(({ id }) => id) }, ...orphan },
      });

      result.deletedFiles += count;
      result.freedBytes += batch.reduce((total, { size }) => total + size, 0);
    }
  }
}

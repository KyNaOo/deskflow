import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { ORPHAN_CLEANUP_QUEUE, OrphanCleanupProcessor } from './orphan-cleanup.processor.js';

/** Côté worker : nettoyage planifié des pièces jointes. */
@Module({
  imports: [BullModule.registerQueue({ name: ORPHAN_CLEANUP_QUEUE }), StorageModule],
  providers: [OrphanCleanupProcessor],
})
export class AttachmentsWorkerModule {}

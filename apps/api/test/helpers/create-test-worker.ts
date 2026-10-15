import type { DynamicModule, Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from '../../src/worker.module.js';

/**
 * Démarre un worker (sans serveur HTTP, comme src/worker.ts) sur le Redis et la base des tests.
 * Ses files utilisent le préfixe propre au fichier de test (voir setup-e2e.ts).
 */
export async function createTestWorker(
  imports: (DynamicModule | Type)[] = [],
): Promise<TestingModule> {
  const worker = await Test.createTestingModule({ imports: [WorkerModule, ...imports] }).compile();
  worker.useLogger(worker.get(Logger));
  // init démarre les workers BullMQ des processors déclarés
  await worker.init();
  return worker;
}

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module.js';

/**
 * Process séparé de l'API, sans serveur HTTP : il exécute les jobs ajoutés dans Redis
 * (BullMQ). Plusieurs workers peuvent tourner : chaque job n'est pris que par un seul.
 */
async function bootstrap() {
  const worker = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  worker.useLogger(worker.get(Logger));
  // SIGTERM (docker stop) : chaque worker BullMQ termine son job en cours avant de fermer
  worker.enableShutdownHooks();
  worker.get(Logger).log('Worker démarré, en attente de jobs', 'Worker');
}
await bootstrap();

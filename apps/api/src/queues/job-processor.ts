import { WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

/**
 * Base de tous les processors du worker : une ligne de log par exécution (file, nom, id,
 * tentative, durée, puis résultat ou erreur). Le résultat sert de synthèse (ex. nombre de
 * tickets clos). Une erreur est relancée pour que BullMQ applique les tentatives restantes.
 */
export abstract class JobProcessor<Data = unknown, Result = void> extends WorkerHost {
  private readonly logger = new Logger(this.constructor.name);

  protected abstract handle(job: Job<Data>): Promise<Result>;

  async process(job: Job<Data>): Promise<Result> {
    const startedAt = performance.now();
    const context = () => ({
      queue: job.queueName,
      job: job.name,
      jobId: job.id,
      attempt: job.attemptsMade + 1,
      // BullMQ fait toujours au moins une tentative, même avec `attempts: 0`
      maxAttempts: Math.max(job.opts.attempts ?? 1, 1),
      durationMs: Math.round(performance.now() - startedAt),
    });

    try {
      const result = await this.handle(job);
      this.logger.log({ ...context(), result }, 'Job terminé');
      return result;
    } catch (error) {
      this.logger.error({ ...context(), err: error }, 'Job en échec');
      throw error;
    }
  }
}

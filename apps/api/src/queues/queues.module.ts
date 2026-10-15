import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createNodeRedisClient, type DefaultJobOptions, RedisConnection } from 'bullmq';
import { createClient } from 'redis';
import type { Env } from '../config/env.js';

/** Options appliquées à tout job, sauf si sa file les redéfinit. */
export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 10_000 },
  // Bornés pour ne pas remplir Redis : un job réussi n'est plus utile, un échec sert au diagnostic
  removeOnComplete: { age: 24 * 3600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

/**
 * Connexion de BullMQ à Redis, partagée par l'API (qui ajoute des jobs) et le worker (qui les
 * exécute). Chaque file y déclare ensuite la sienne avec `BullModule.registerQueue`.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        // BullMQ crée lui-même ses connexions (dont une bloquante par worker) avec ioredis, qu'il
        // ne sait pas charger dans une application ESM : on lui fournit le client node-redis
        // déjà utilisé par l'API. Chaque file et chaque worker ouvre et ferme ainsi le sien.
        RedisConnection.clientFactory = (options) =>
          createNodeRedisClient(createClient({ url: options.url }));

        return {
          connection: { url: config.get('REDIS_URL', { infer: true }) },
          prefix: config.get('QUEUE_PREFIX', { infer: true }),
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        };
      },
    }),
  ],
})
export class QueuesModule {}

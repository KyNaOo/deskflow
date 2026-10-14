import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import type { Env } from '../config/env.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export type RedisClient = Awaited<ReturnType<typeof connectRedis>>;

const logger = new Logger('Redis');

/** Client Redis connecté, qui journalise ses erreurs au lieu de faire tomber le process. */
export async function connectRedis(url: string) {
  const client = createClient({ url });
  // Sans écouteur, une coupure de Redis lèverait une erreur non gérée ; le client se reconnecte seul
  client.on('error', (error: Error) => logger.error(error.message));
  await client.connect();
  return client;
}

// Global : client partagé, injectable partout (healthcheck). Socket.io a ses propres clients pub/sub.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => connectRedis(config.get('REDIS_URL', { infer: true })),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  async onApplicationShutdown() {
    await this.redis.close();
  }
}

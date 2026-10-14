import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { REDIS_CLIENT, type RedisClient } from '../redis/redis.module.js';

const PING_TIMEOUT_MS = 1000;

/** Redis porte le temps réel multi-instances (et bientôt les files) : l'API en dépend. */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async pingCheck(key: string) {
    const indicator = this.healthIndicator.check(key);
    try {
      // Pendant une coupure, le client met les commandes en attente au lieu d'échouer : on borne
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PING_TIMEOUT_MS)),
      ]);
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }
}

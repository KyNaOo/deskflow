import { Inject, Injectable, Module } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import { REDIS_CLIENT, type RedisClient } from '../redis/redis.module.js';
import { rooms } from './realtime-rooms.js';

/**
 * Événements temps réel émis depuis le worker, qui n'a pas de serveur Socket.io : ils sont
 * publiés dans Redis, sur le canal de l'adapter des instances de l'API, qui les relaient aux
 * navigateurs des rooms visées (même mécanisme qu'entre deux instances de l'API).
 * Le tenant est passé explicitement : un job transverse n'a pas de contexte tenant.
 */
@Injectable()
export class RealtimePublisher {
  private readonly emitter: Emitter;

  constructor(@Inject(REDIS_CLIENT) redis: RedisClient) {
    this.emitter = new Emitter(redis);
  }

  ticketUpdated(tenantId: string, ticket: { id: string }) {
    this.emitter.to(rooms.ticketUpdated(tenantId, ticket.id)).emit('ticket.updated', ticket);
  }
}

@Module({
  providers: [RealtimePublisher],
  exports: [RealtimePublisher],
})
export class RealtimePublisherModule {}

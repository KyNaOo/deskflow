import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import type { Env } from '../config/env.js';
import { connectRedis, type RedisClient } from '../redis/redis.module.js';

/**
 * Serveur Socket.io configuré depuis l'environnement validé (les options du décorateur
 * @WebSocketGateway sont statiques). Branché dans main.ts et dans les tests e2e :
 * `const adapter = new RealtimeIoAdapter(app); await adapter.connectToRedis();`
 *
 * Sans adapter, chaque instance de l'API ne connaît que ses propres sockets : un événement émis
 * par l'instance 1 n'atteindrait pas un navigateur connecté à l'instance 2. L'adapter Redis publie
 * chaque émission sur Redis ; chaque instance la reçoit et la relaie à ses sockets de la room.
 */
export class RealtimeIoAdapter extends IoAdapter {
  private pubClient?: RedisClient;
  private subClient?: RedisClient;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  /** Un client Redis en mode abonné ne peut rien faire d'autre : il en faut deux dédiés. */
  async connectToRedis() {
    const url = this.config().get('REDIS_URL', { infer: true });
    [this.pubClient, this.subClient] = await Promise.all([connectRedis(url), connectRedis(url)]);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    if (!this.pubClient || !this.subClient) {
      throw new Error('RealtimeIoAdapter : appeler connectToRedis() avant de démarrer l’application');
    }
    // Nest transmet des options partielles (celles du décorateur) : Socket.io complète le reste
    const server = super.createIOServer(port, {
      ...options,
      // Même règle que l'API REST : seule l'origine du front, avec ses cookies
      cors: { origin: this.config().get('WEB_URL', { infer: true }), credentials: true },
    } as ServerOptions);
    server.adapter(createAdapter(this.pubClient, this.subClient));
    return server;
  }

  private config() {
    return this.app.get<ConfigService<Env, true>>(ConfigService);
  }

  /** Appelé par Nest à l'arrêt de l'application (app.close(), SIGTERM). */
  override async dispose() {
    await Promise.all([this.pubClient?.close(), this.subClient?.close()]);
  }
}

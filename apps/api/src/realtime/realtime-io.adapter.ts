import type { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import type { Env } from '../config/env.js';

/**
 * Serveur Socket.io configuré depuis l'environnement validé (les options du décorateur
 * @WebSocketGateway sont statiques). Branché dans main.ts et dans les tests e2e.
 */
export class RealtimeIoAdapter extends IoAdapter {
  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const config = this.app.get<ConfigService<Env, true>>(ConfigService);
    // Nest transmet des options partielles (celles du décorateur) : Socket.io complète le reste
    return super.createIOServer(port, {
      ...options,
      // Même règle que l'API REST : seule l'origine du front, avec ses cookies
      cors: { origin: config.get('WEB_URL', { infer: true }), credentials: true },
    } as ServerOptions);
  }
}

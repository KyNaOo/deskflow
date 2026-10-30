import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { setupOpenApi } from './common/openapi.js';
import type { Env } from './config/env.js';
import { RealtimeIoAdapter } from './realtime/realtime-io.adapter.js';

async function bootstrap() {
  // Logs du démarrage mis en attente puis écrits par pino, comme tous les autres
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Le front appelle l'API depuis le navigateur : seule son origine est autorisée,
  // avec les cookies (credentials) pour transmettre la session
  app.enableCors({
    origin: config.get('WEB_URL', { infer: true }),
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });

  // Sans secret : servie aussi en production, mais en lecture seule
  setupOpenApi(app, { readOnly: config.get('NODE_ENV', { infer: true }) === 'production' });

  const realtimeAdapter = new RealtimeIoAdapter(app);
  await realtimeAdapter.connectToRedis();
  app.useWebSocketAdapter(realtimeAdapter);
  // SIGTERM (docker stop) : Nest ferme proprement les connexions (base, Redis, sockets)
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();

import { DynamicModule, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Logger } from 'nestjs-pino';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { setupOpenApi } from '../../src/common/openapi.js';
import { RealtimeIoAdapter } from '../../src/realtime/realtime-io.adapter.js';

interface TestAppOptions {
  /** À désactiver dans les suites qui enchaînent plus de connexions/inscriptions que la limite. */
  rateLimit?: boolean;
  /** Modules ajoutés à l'app, ex. une file de test : `BullModule.registerQueue(...)`. */
  imports?: DynamicModule[];
}

/** Démarre l'application complète (config, base réelle, pipes globaux) pour les tests e2e. */
export async function createTestApp({
  rateLimit = true,
  imports = [],
}: TestAppOptions = {}): Promise<INestApplication<App>> {
  const builder = Test.createTestingModule({ imports: [AppModule, ...imports] });
  if (!rateLimit) {
    builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  }

  const app = (await builder.compile()).createNestApplication<INestApplication<App>>({
    bufferLogs: true,
  });
  // Même logger qu'en production (muet pendant les tests, voir loggerConfig)
  app.useLogger(app.get(Logger));
  setupOpenApi(app, { readOnly: false });
  const realtimeAdapter = new RealtimeIoAdapter(app);
  await realtimeAdapter.connectToRedis();
  app.useWebSocketAdapter(realtimeAdapter);
  // Port libre choisi par l'OS : supertest réutilise ce serveur au lieu d'en démarrer un par requête
  await app.listen(0);
  return app;
}

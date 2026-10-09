import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';

interface TestAppOptions {
  /** À désactiver dans les suites qui enchaînent plus de connexions/inscriptions que la limite. */
  rateLimit?: boolean;
}

/** Démarre l'application complète (config, base réelle, pipes globaux) pour les tests e2e. */
export async function createTestApp({ rateLimit = true }: TestAppOptions = {}): Promise<
  INestApplication<App>
> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (!rateLimit) {
    builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  }

  const app = (await builder.compile()).createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
}

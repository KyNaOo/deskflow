import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Le front appelle l'API depuis le navigateur : seule son origine est autorisée,
  // avec les cookies (credentials) pour transmettre la session
  app.enableCors({ origin: config.get('WEB_URL', { infer: true }), credentials: true });

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();

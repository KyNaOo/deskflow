import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { loggerConfig } from './common/logger.config.js';
import { type Env, validateEnv } from './config/env.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueuesModule } from './queues/queues.module.js';

/**
 * Socle commun aux deux points d'entrée, l'API (`main.ts`) et le worker (`worker.ts`) :
 * config validée, logs, contexte tenant, base de données, files de jobs.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Les variables sont injectées par Docker Compose : pas de lecture de fichier .env
      ignoreEnvFile: true,
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        loggerConfig(config.get('NODE_ENV', { infer: true })),
    }),
    // Contexte isolé (AsyncLocalStorage) : ouvert à chaque requête HTTP par le middleware puis
    // alimenté par JwtAuthGuard, ou explicitement par TenantContext.run (WebSocket, jobs)
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    PrismaModule,
    QueuesModule,
  ],
})
export class CoreModule {}

import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { loggerConfig } from './common/logger.config.js';
import { type Env, validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';

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
    // Ouvre un contexte isolé par requête (AsyncLocalStorage), alimenté ensuite par JwtAuthGuard
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    PrismaModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    // Déclaré ici plutôt que dans main.ts pour s'appliquer aussi aux tests e2e
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      // Déclaré ici plutôt que dans main.ts pour s'appliquer aussi aux tests e2e
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // retire les champs non déclarés dans le DTO…
        forbidNonWhitelisted: true, // …et refuse la requête s'il y en a
        transform: true, // body → instance du DTO (active les @Transform)
      }),
    },
  ],
})
export class AppModule implements NestModule {
  // Déclaré ici plutôt que dans main.ts pour s'appliquer aussi aux tests e2e
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cookieParser()).forRoutes('*');
  }
}

import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { ClsModule } from 'nestjs-cls';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
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
    // Ouvre un contexte isolé par requête (AsyncLocalStorage), alimenté ensuite par JwtAuthGuard
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
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

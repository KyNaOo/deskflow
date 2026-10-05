import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { validateEnv } from './config/env.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Les variables sont injectées par Docker Compose : pas de lecture de fichier .env
      ignoreEnvFile: true,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
export class AppModule {}

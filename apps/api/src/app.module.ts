import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { ZodValidationPipe } from './common/zod-validation.js';
import { CoreModule } from './core.module.js';
import { HealthModule } from './health/health.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { RedisModule } from './redis/redis.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    CoreModule,
    RedisModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    TicketsModule,
    MessagesModule,
    AttachmentsModule,
    AnalyticsModule,
  ],
  providers: [
    // Déclaré ici plutôt que dans main.ts pour s'appliquer aussi aux tests e2e
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Valide les body et query qui déclarent un schéma zod (`@Body({ schema })`, @deskflow/shared)
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule implements NestModule {
  // Déclaré ici plutôt que dans main.ts pour s'appliquer aussi aux tests e2e
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(cookieParser()).forRoutes('*');
  }
}

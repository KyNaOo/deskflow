import { Module } from '@nestjs/common';
import { AttachmentsWorkerModule } from './attachments/attachments-worker.module.js';
import { CoreModule } from './core.module.js';
import { EmailsWorkerModule } from './emails/emails-worker.module.js';
import { RedisModule } from './redis/redis.module.js';
import { TicketsWorkerModule } from './tickets/tickets-worker.module.js';

/**
 * Point d'entrée du worker : le socle commun et les processors, qui ne sont déclarés qu'ici.
 * L'API ajoute des jobs dans les files mais ne les exécute jamais.
 */
@Module({
  imports: [
    CoreModule,
    RedisModule,
    EmailsWorkerModule,
    TicketsWorkerModule,
    AttachmentsWorkerModule,
  ],
})
export class WorkerModule {}

import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RealtimePublisherModule } from '../realtime/realtime-publisher.js';
import { AUTO_CLOSE_QUEUE, AutoCloseProcessor } from './auto-close.processor.js';

/** Côté worker : tâches planifiées sur les tickets. */
@Module({
  imports: [BullModule.registerQueue({ name: AUTO_CLOSE_QUEUE }), RealtimePublisherModule],
  providers: [AutoCloseProcessor],
})
export class TicketsWorkerModule {}

import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { EmailsModule } from '../emails/emails.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';

@Module({
  imports: [RealtimeModule, AttachmentsModule, EmailsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}

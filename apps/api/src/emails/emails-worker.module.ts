import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { EmailsProcessor } from './emails.processor.js';
import { emailsQueue } from './emails.queue.js';

/** Côté worker : exécution des envois. Seul module qui parle au serveur SMTP. */
@Module({
  imports: [emailsQueue, MailModule],
  providers: [EmailsProcessor],
})
export class EmailsWorkerModule {}

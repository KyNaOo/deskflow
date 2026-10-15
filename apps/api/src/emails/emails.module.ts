import { Module } from '@nestjs/common';
import { emailsQueue } from './emails.queue.js';
import { EmailsService } from './emails.service.js';

/** Côté API : ajout des e-mails dans la file (aucun envoi SMTP dans une requête). */
@Module({
  imports: [emailsQueue],
  providers: [EmailsService],
  exports: [EmailsService],
})
export class EmailsModule {}

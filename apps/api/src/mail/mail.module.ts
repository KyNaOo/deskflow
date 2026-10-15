import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';

// Importé uniquement par le worker : l'API n'envoie jamais d'e-mail elle-même (file `emails`)
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

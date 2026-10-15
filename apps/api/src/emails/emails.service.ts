import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { MailMessage } from '../mail/mail.service.js';
import { EMAILS_QUEUE } from './emails.queue.js';

/**
 * Côté API : confie un e-mail au worker au lieu de l'envoyer pendant la requête. Un serveur
 * SMTP lent ou en panne ne ralentit ni ne fait échouer la réponse ; l'envoi est retenté.
 */
@Injectable()
export class EmailsService {
  constructor(@InjectQueue(EMAILS_QUEUE) private readonly queue: Queue<MailMessage>) {}

  /**
   * `jobId` identifie l'événement à l'origine de l'e-mail (ex. `reply-<messageId>`) : BullMQ
   * ignore un second ajout avec le même id, donc un événement rejoué n'envoie pas deux e-mails.
   */
  async send(jobId: string, message: MailMessage): Promise<void> {
    await this.queue.add('send', message, { jobId });
  }
}

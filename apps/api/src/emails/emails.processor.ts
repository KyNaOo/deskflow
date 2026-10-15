import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { type MailMessage, MailService } from '../mail/mail.service.js';
import { JobProcessor } from '../queues/job-processor.js';
import { EMAILS_QUEUE } from './emails.queue.js';

/** Côté worker : envoie l'e-mail du job. Une erreur SMTP fait retenter le job (backoff). */
@Processor(EMAILS_QUEUE)
export class EmailsProcessor extends JobProcessor<MailMessage> {
  constructor(private readonly mail: MailService) {
    super();
  }

  protected async handle(job: Job<MailMessage>): Promise<void> {
    await this.mail.send(job.data);
  }
}

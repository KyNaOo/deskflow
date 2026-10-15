import { BullModule } from '@nestjs/bullmq';
import { DEFAULT_JOB_OPTIONS } from '../queues/queues.module.js';

export const EMAILS_QUEUE = 'emails';

/**
 * File des e-mails, déclarée à l'identique côté API (ajout) et côté worker (envoi).
 * 5 tentatives espacées de 10 s, 20 s, 40 s, 80 s : un serveur SMTP indisponible
 * quelques minutes ne fait perdre aucun e-mail.
 */
export const emailsQueue = BullModule.registerQueue({
  name: EMAILS_QUEUE,
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 5 },
});

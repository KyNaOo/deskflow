import { InjectQueue, Processor } from '@nestjs/bullmq';
import { OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { TicketStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobProcessor } from '../queues/job-processor.js';
import { RealtimePublisher } from '../realtime/realtime-publisher.js';
import { autoCloseCutoff } from './auto-close.js';
import { ticketSelect } from './ticket-select.js';
import { transitionData } from './ticket-transition.js';

export const AUTO_CLOSE_QUEUE = 'auto-close-tickets';

/** Tickets clos par transaction : borne la durée des verrous sur une table très active. */
const BATCH_SIZE = 500;

interface AutoCloseResult {
  closed: number;
}

/**
 * Clôt les tickets RESOLVED depuis plus de AUTO_CLOSE_AFTER_DAYS jours, tous tenants confondus.
 * Planifié toutes les heures ; un passage manqué (worker arrêté) est rattrapé au suivant.
 */
@Processor(AUTO_CLOSE_QUEUE)
export class AutoCloseProcessor
  extends JobProcessor<unknown, AutoCloseResult>
  implements OnApplicationBootstrap
{
  constructor(
    @InjectQueue(AUTO_CLOSE_QUEUE) private readonly queue: Queue,
    // Client non filtré, volontairement : ce job traite tous les tenants à la fois et n'agit
    // pour le compte d'aucun utilisateur. Le tenant de chaque ticket n'est lu que pour
    // adresser l'événement temps réel à la bonne room.
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimePublisher,
  ) {
    super();
  }

  /**
   * Idempotent : chaque worker déclare le même planning au démarrage, sous le même id. Redis
   * n'en garde qu'un, donc un seul job par créneau, quel que soit le nombre de workers.
   */
  async onApplicationBootstrap() {
    await this.queue.upsertJobScheduler(
      'auto-close-tickets-hourly',
      { pattern: '0 * * * *' },
      { name: 'close-resolved-tickets' },
    );
  }

  protected async handle(): Promise<AutoCloseResult> {
    // RESOLVED → CLOSED autorisé par la machine à états ; resolvedAt est conservé (Jalon 5)
    const data = transitionData(TicketStatus.RESOLVED, TicketStatus.CLOSED);
    const expired = { status: TicketStatus.RESOLVED, resolvedAt: { lt: autoCloseCutoff(new Date()) } };
    let closed = 0;

    for (;;) {
      const batch = await this.prisma.ticket.findMany({
        where: expired,
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) {
        return { closed };
      }

      // Condition répétée dans l'UPDATE : un ticket rouvert depuis la lecture n'est pas touché
      const tickets = await this.prisma.ticket.updateManyAndReturn({
        where: { id: { in: batch.map(({ id }) => id) }, ...expired },
        data,
        select: { ...ticketSelect, tenantId: true },
      });
      for (const { tenantId, ...ticket } of tickets) {
        this.realtime.ticketUpdated(tenantId, ticket);
      }
      closed += tickets.length;
    }
  }
}

import type { CreateTicketInput, ListTicketsQuery, UpdateTicketInput } from '@deskflow/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { TenantContext } from '../common/tenant-context.js';
import { type Prisma, Role } from '../generated/prisma/client.js';
import { TENANT_PRISMA, type TenantPrisma } from '../prisma/tenant-prisma.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { afterCursor, decodeCursor, encodeCursor, TICKET_LIST_ORDER } from './ticket-cursor.js';
import { ticketAccessFilter } from './ticket-access.js';
import { ticketSelect } from './ticket-select.js';
import { transitionData } from './ticket-transition.js';

@Injectable()
export class TicketsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly tenantContext: TenantContext,
    private readonly realtime: RealtimeService,
  ) {}

  /** Ouvre un ticket et enregistre sa description comme premier message (les deux, ou rien). */
  async create(author: AuthenticatedUser, dto: CreateTicketInput) {
    const customerId = await this.resolveCustomerId(author, dto.customerId);
    const tenantId = this.tenantContext.tenantId;

    const ticket = await this.prisma.$transaction(async (tx) => {
      // Incrément atomique (UPDATE … SET ticket_counter = ticket_counter + 1 RETURNING) :
      // la ligne du tenant reste verrouillée jusqu'à la fin de la transaction, donc deux
      // créations simultanées obtiennent forcément deux numéros différents.
      // Un MAX(number) + 1 donnerait le même numéro aux deux.
      const { ticketCounter: number } = await tx.tenant.update({
        where: { id: tenantId },
        data: { ticketCounter: { increment: 1 } },
        select: { ticketCounter: true },
      });

      return tx.ticket.create({
        data: {
          tenantId,
          number,
          subject: dto.subject,
          priority: dto.priority,
          customerId,
          messages: { create: { authorId: author.id, body: dto.message } },
        },
        select: ticketSelect,
      });
    });

    this.realtime.ticketCreated(ticket);
    return ticket;
  }

  /**
   * Liste filtrée et paginée par curseur. Un client ne voit que ses propres tickets : c'est
   * aussi la liste « Mes tickets » du portail.
   */
  async list(reader: AuthenticatedUser, query: ListTicketsQuery) {
    const filters: Prisma.TicketWhereInput[] = [
      { status: query.status, priority: query.priority },
      ticketAccessFilter(reader),
      assigneeFilter(query.assignee, reader.id),
      query.q ? await this.searchFilter(query.q) : {},
      query.cursor ? afterCursor(decodeCursor(query.cursor)) : {},
    ];

    // Un ticket de plus que demandé : s'il existe, il y a une page suivante
    const tickets = await this.prisma.ticket.findMany({
      where: { AND: filters },
      orderBy: TICKET_LIST_ORDER,
      take: query.limit + 1,
      select: ticketSelect,
    });

    const items = tickets.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: tickets.length > query.limit && last ? encodeCursor(last) : null,
    };
  }

  /** Un client ne lit que ses propres tickets ; sinon 404, sans confirmer que le ticket existe. */
  findByNumber(reader: AuthenticatedUser, number: number) {
    return this.getTicket({ number, ...ticketAccessFilter(reader) });
  }

  /** Statut (via la machine à états), priorité et assignation, modifiés par un agent. */
  async update(number: number, dto: UpdateTicketInput) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { number },
      select: { id: true, status: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }
    if (dto.assigneeId) {
      await this.assertAssignable(dto.assigneeId);
    }

    const changesStatus = dto.status !== undefined && dto.status !== ticket.status;
    const { count } = await this.prisma.ticket.updateMany({
      // Conditionnel sur le statut lu : si un autre agent l'a changé entre-temps, la transition
      // a été vérifiée sur une valeur périmée et rien n'est modifié
      where: { id: ticket.id, ...(changesStatus && { status: ticket.status }) },
      data: {
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        ...(changesStatus && transitionData(ticket.status, dto.status!)),
      },
    });
    if (count === 0) {
      throw new ConflictException('Le ticket a été modifié entre-temps, rechargez-le');
    }

    const updated = await this.getTicket({ id: ticket.id });
    this.realtime.ticketUpdated(updated);
    return updated;
  }

  /** Un numéro (`42`, `#42`) désigne un ticket précis ; sinon recherche plein texte dans le sujet. */
  private async searchFilter(q: string): Promise<Prisma.TicketWhereInput> {
    const number = /^#?(\d{1,9})$/.exec(q)?.[1];
    if (number) {
      return { number: Number(number) };
    }

    // SQL brut : Prisma ne sait pas filtrer une colonne tsvector. Le filtre tenant, ajouté
    // automatiquement à toutes les autres requêtes, doit donc être écrit ici, explicitement.
    // Valeurs paramétrées par le template $queryRaw : aucune concaténation de la saisie.
    const matches = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM tickets
      WHERE tenant_id = ${this.tenantContext.tenantId}::uuid
        AND search_vector @@ websearch_to_tsquery('french_unaccent', ${q})`;
    return { id: { in: matches.map(({ id }) => id) } };
  }

  private async getTicket(where: Prisma.TicketWhereInput) {
    const ticket = await this.prisma.ticket.findFirst({ where, select: ticketSelect });
    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }
    return ticket;
  }

  /** Seul un agent ou un admin de l'organisation peut être assigné à un ticket. */
  private async assertAssignable(userId: string) {
    const assignee = await this.prisma.user.findFirst({
      where: { id: userId, role: { in: [Role.ADMIN, Role.AGENT] } },
      select: { id: true },
    });
    if (!assignee) {
      throw new BadRequestException('assigneeId : aucun agent de l’organisation avec cet identifiant');
    }
  }

  /** Un client ouvre toujours un ticket pour lui-même ; un agent l'ouvre pour un client du tenant. */
  private async resolveCustomerId(author: AuthenticatedUser, customerId?: string) {
    if (author.role === Role.CUSTOMER) {
      if (customerId) {
        throw new BadRequestException('customerId : un client ne peut ouvrir un ticket que pour lui-même');
      }
      return author.id;
    }

    if (!customerId) {
      throw new BadRequestException('customerId : client du ticket obligatoire');
    }
    const customer = await this.prisma.user.findFirst({
      where: { id: customerId, role: Role.CUSTOMER },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException('customerId : aucun client de l’organisation avec cet identifiant');
    }
    return customer.id;
  }
}

function assigneeFilter(assignee: string | undefined, readerId: string): Prisma.TicketWhereInput {
  if (assignee === 'me') {
    return { assigneeId: readerId };
  }
  if (assignee === 'none') {
    return { assigneeId: null };
  }
  return assignee ? { assigneeId: assignee } : {};
}

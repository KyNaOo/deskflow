import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { type Prisma, Role, TicketStatus } from '../generated/prisma/client.js';
import { TENANT_PRISMA, type TenantPrisma } from '../prisma/tenant-prisma.js';
import { ticketAccessFilter } from '../tickets/ticket-access.js';
import { automaticTransition } from './automatic-transition.js';
import { CreateMessageDto } from './dto/create-message.dto.js';

const messageSelect = {
  id: true,
  body: true,
  isInternalNote: true,
  aiGenerated: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
} satisfies Prisma.MessageSelect;

/**
 * Les messages n'ont pas de tenantId : on y accède toujours à travers leur ticket, lui-même
 * filtré par tenant (client Prisma filtré) et par participant (ticketAccessFilter).
 */
@Injectable()
export class MessagesService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  /** Conversation dans l'ordre chronologique. Un client ne reçoit jamais les notes internes. */
  async list(reader: AuthenticatedUser, ticketNumber: number) {
    const ticket = await this.findTicket(reader, ticketNumber);

    return this.prisma.message.findMany({
      where: {
        ticketId: ticket.id,
        // Filtre dans la requête elle-même : une note interne ne quitte jamais la base pour un client
        ...(reader.role === Role.CUSTOMER && { isInternalNote: false }),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: messageSelect,
    });
  }

  async create(author: AuthenticatedUser, ticketNumber: number, dto: CreateMessageDto) {
    const isCustomer = author.role === Role.CUSTOMER;
    const isInternalNote = dto.isInternalNote ?? false;
    if (isCustomer && isInternalNote) {
      throw new ForbiddenException('Un client ne peut pas écrire de note interne');
    }

    const ticket = await this.findTicket(author, ticketNumber);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Fait remonter le ticket dans la liste et verrouille sa ligne jusqu'à la fin de la
      // transaction ; conditionnel : rien n'est écrit sur un ticket clos, même entre-temps
      const { count } = await tx.ticket.updateMany({
        where: { id: ticket.id, status: { not: TicketStatus.CLOSED } },
        data: { updatedAt: now },
      });
      if (count === 0) {
        throw new ConflictException('Ce ticket est clos : impossible d’y ajouter un message');
      }

      const message = await tx.message.create({
        data: { ticketId: ticket.id, authorId: author.id, body: dto.body, isInternalNote },
        select: messageSelect,
      });

      if (!isCustomer && !isInternalNote) {
        // Délai de première réponse (indicateur du Jalon 6) : posé une seule fois
        await tx.ticket.updateMany({
          where: { id: ticket.id, firstResponseAt: null },
          data: { firstResponseAt: now },
        });
      }

      const transition = automaticTransition(isCustomer, isInternalNote);
      if (transition) {
        // Appliquée seulement si le ticket est encore dans un des statuts de départ ;
        // la réouverture efface resolvedAt (déjà nul depuis PENDING)
        await tx.ticket.updateMany({
          where: { id: ticket.id, status: { in: transition.from } },
          data: { status: transition.to, ...(transition.to === TicketStatus.OPEN && { resolvedAt: null }) },
        });
      }

      return message;
    });
  }

  private async findTicket(reader: AuthenticatedUser, number: number) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { number, ...ticketAccessFilter(reader) },
      select: { id: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }
    return ticket;
  }
}

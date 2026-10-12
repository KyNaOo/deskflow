import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { TenantContext } from '../common/tenant-context.js';
import { Role } from '../generated/prisma/client.js';
import { TENANT_PRISMA, type TenantPrisma } from '../prisma/tenant-prisma.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ticketSelect } from './ticket-select.js';

@Injectable()
export class TicketsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly tenantContext: TenantContext,
  ) {}

  /** Ouvre un ticket et enregistre sa description comme premier message (les deux, ou rien). */
  async create(author: AuthenticatedUser, dto: CreateTicketDto) {
    const customerId = await this.resolveCustomerId(author, dto.customerId);
    const tenantId = this.tenantContext.tenantId;

    return this.prisma.$transaction(async (tx) => {
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
  }

  /** Un client ne lit que ses propres tickets ; sinon 404, sans confirmer que le ticket existe. */
  async findByNumber(reader: AuthenticatedUser, number: number) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { number, ...(reader.role === Role.CUSTOMER && { customerId: reader.id }) },
      select: ticketSelect,
    });

    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }
    return ticket;
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

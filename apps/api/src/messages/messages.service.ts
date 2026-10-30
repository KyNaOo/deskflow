import type { CreateMessageInput } from '@deskflow/shared';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { attachmentSelect, AttachmentsService } from '../attachments/attachments.service.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import type { Env } from '../config/env.js';
import { EmailsService } from '../emails/emails.service.js';
import { type Prisma, Role, TicketStatus } from '../generated/prisma/client.js';
import { TENANT_PRISMA, type TenantPrisma } from '../prisma/tenant-prisma.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ticketAccessFilter } from '../tickets/ticket-access.js';
import { ticketSelect } from '../tickets/ticket-select.js';
import { automaticTransition } from './automatic-transition.js';
import { replyEmail } from './reply-email.js';

const messageSelect = {
  id: true,
  body: true,
  isInternalNote: true,
  createdAt: true,
  author: { select: { id: true, name: true, role: true } },
  attachments: { select: attachmentSelect, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.MessageSelect;

type Message = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

const ticketSummarySelect = {
  id: true,
  number: true,
  subject: true,
  customer: { select: { email: true } },
  tenant: { select: { slug: true } },
} satisfies Prisma.TicketSelect;

type TicketSummary = Prisma.TicketGetPayload<{ select: typeof ticketSummarySelect }>;

/**
 * Les messages n'ont pas de tenantId : on y accède toujours à travers leur ticket, lui-même
 * filtré par tenant (client Prisma filtré) et par participant (ticketAccessFilter).
 */
@Injectable()
export class MessagesService {
  private readonly webUrl: string;

  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly realtime: RealtimeService,
    private readonly attachments: AttachmentsService,
    private readonly emails: EmailsService,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

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

  async create(author: AuthenticatedUser, ticketNumber: number, dto: CreateMessageInput) {
    const isCustomer = author.role === Role.CUSTOMER;
    const isInternalNote = dto.isInternalNote ?? false;
    if (isCustomer && isInternalNote) {
      throw new ForbiddenException('Un client ne peut pas écrire de note interne');
    }

    const ticket = await this.findTicket(author, ticketNumber);
    const attachments = await this.attachments.findUploaded(ticket.id, author.id, dto.attachmentIds ?? []);
    const now = new Date();

    const message = await this.prisma.$transaction(async (tx) => {
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

      if (attachments.length > 0) {
        // Conditionnel : une pièce jointe rattachée entre-temps à un autre message n'est pas volée
        const { count: attached } = await tx.attachment.updateMany({
          where: { id: { in: attachments.map(({ id }) => id) }, messageId: null },
          data: { messageId: message.id },
        });
        if (attached !== attachments.length) {
          throw new ConflictException('Une pièce jointe vient d’être utilisée par un autre message');
        }
      }

      if (!isCustomer && !isInternalNote) {
        // Délai de première réponse (indicateur du Jalon 5) : posé une seule fois
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

      return { ...message, attachments };
    });

    this.realtime.messageCreated(ticket, message);
    if (!isInternalNote) {
      // Statut et date de première réponse ont pu changer. Pas pour une note interne : le client
      // verrait le ticket bouger et devinerait qu'on écrit sur lui.
      this.realtime.ticketUpdated(
        await this.prisma.ticket.findFirstOrThrow({ where: { id: ticket.id }, select: ticketSelect }),
      );
    }
    if (!isCustomer && !isInternalNote) {
      await this.notifyCustomer(ticket, message);
    }
    return message;
  }

  /** E-mail au client pour une réponse d'agent, ajouté après le commit (jamais pour un rollback). */
  private notifyCustomer(ticket: TicketSummary, message: Message) {
    return this.emails.send(
      `reply-${message.id}`,
      replyEmail({
        to: ticket.customer.email,
        agentName: message.author.name,
        ticketNumber: ticket.number,
        ticketSubject: ticket.subject,
        messageBody: message.body,
        link: `${this.webUrl}/portal/${ticket.tenant.slug}/tickets/${ticket.number}`,
      }),
    );
  }

  private async findTicket(reader: AuthenticatedUser, number: number) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { number, ...ticketAccessFilter(reader) },
      select: ticketSummarySelect,
    });
    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }
    return ticket;
  }
}

import type { CreateAttachmentInput } from '@deskflow/shared';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { TenantContext } from '../common/tenant-context.js';
import { type Prisma, Role, TicketStatus } from '../generated/prisma/client.js';
import { TENANT_PRISMA, type TenantPrisma } from '../prisma/tenant-prisma.js';
import { attachmentKey } from '../storage/storage-keys.js';
import { StorageService } from '../storage/storage.service.js';
import { ticketAccessFilter } from '../tickets/ticket-access.js';

/** Champs d'une pièce jointe renvoyés par l'API (jamais la clé de stockage). */
export const attachmentSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  size: true,
} satisfies Prisma.AttachmentSelect;

/**
 * Les pièces jointes n'ont pas de tenantId : comme les messages, on y accède toujours à travers
 * leur ticket, lui-même filtré par tenant (client Prisma filtré) et par participant.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly tenantContext: TenantContext,
    private readonly storage: StorageService,
  ) {}

  /**
   * Enregistre la pièce jointe (sans message pour l'instant) et signe le formulaire d'envoi.
   * Type et taille sont validés ici, puis imposés par le stockage via les conditions signées.
   */
  async create(uploader: AuthenticatedUser, ticketNumber: number, dto: CreateAttachmentInput) {
    const ticket = await this.findTicket(uploader, ticketNumber);
    if (ticket.status === TicketStatus.CLOSED) {
      throw new ConflictException('Ce ticket est clos : impossible d’y joindre un fichier');
    }

    const { fileKey, ...attachment } = await this.prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        uploaderId: uploader.id,
        fileKey: attachmentKey(this.tenantContext.tenantId, ticket.id),
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        size: dto.size,
      },
      select: { ...attachmentSelect, fileKey: true },
    });
    const upload = await this.storage.createUpload(fileKey, dto.mimeType, dto.size);
    return { attachment, upload };
  }

  /**
   * URL de lecture temporaire. Seules les pièces jointes d'un message envoyé sont lisibles,
   * et celles d'une note interne ne le sont jamais par un client (404, comme le reste).
   */
  async downloadUrl(reader: AuthenticatedUser, ticketNumber: number, attachmentId: string): Promise<string> {
    const ticket = await this.findTicket(reader, ticketNumber);
    const attachment = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        ticketId: ticket.id,
        messageId: { not: null },
        ...(reader.role === Role.CUSTOMER && { message: { is: { isInternalNote: false } } }),
      },
      select: { fileKey: true, fileName: true, mimeType: true },
    });
    if (!attachment) {
      throw new NotFoundException('Pièce jointe introuvable');
    }
    return this.storage.downloadUrl(attachment.fileKey, attachment.fileName, attachment.mimeType);
  }

  /**
   * Pièces jointes à rattacher à un nouveau message : envoyées par son auteur sur ce ticket,
   * pas encore utilisées, et réellement présentes dans le stockage.
   */
  async findUploaded(ticketId: string, uploaderId: string, ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) {
      return [];
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { id: { in: uniqueIds }, ticketId, uploaderId, messageId: null },
      select: { ...attachmentSelect, fileKey: true },
      orderBy: { createdAt: 'asc' },
    });
    if (attachments.length !== uniqueIds.length) {
      throw new BadRequestException('attachmentIds : pièce jointe introuvable ou déjà utilisée');
    }
    for (const { fileKey, fileName } of attachments) {
      if (!(await this.storage.exists(fileKey))) {
        throw new BadRequestException(`Le fichier « ${fileName} » n’a pas été envoyé`);
      }
    }
    return attachments.map(({ fileKey: _fileKey, ...attachment }) => attachment);
  }

  private async findTicket(reader: AuthenticatedUser, number: number) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { number, ...ticketAccessFilter(reader) },
      select: { id: true, status: true },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket introuvable');
    }
    return ticket;
  }
}

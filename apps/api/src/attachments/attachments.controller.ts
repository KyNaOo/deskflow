import { createAttachmentSchema, type CreateAttachmentInput } from '@deskflow/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Redirect } from '@nestjs/common';
import { ApiConflictResponse } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { TicketNumberPipe } from '../tickets/ticket-number.pipe.js';
import { AttachmentsService } from './attachments.service.js';

/** Pièces jointes d'un ticket : son client et les agents de l'organisation (sinon 404). */
@Controller('tickets/:number/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /** Signe l'envoi : le navigateur envoie ensuite le fichier directement au stockage. */
  @Post()
  @ApiConflictResponse({ description: 'Ticket clos' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('number', TicketNumberPipe) number: number,
    @Body({ schema: createAttachmentSchema }) dto: CreateAttachmentInput,
  ) {
    return this.attachmentsService.create(user, number, dto);
  }

  /** Lien stable vers une pièce jointe : redirige vers une URL de lecture valable quelques minutes. */
  @Get(':id')
  @Redirect()
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('number', TicketNumberPipe) number: number,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { url: await this.attachmentsService.downloadUrl(user, number, id) };
  }
}

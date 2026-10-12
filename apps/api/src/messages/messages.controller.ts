import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { TicketNumberPipe } from '../tickets/ticket-number.pipe.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { MessagesService } from './messages.service.js';

/** Conversation d'un ticket : son client et les agents de l'organisation (sinon 404). */
@Controller('tickets/:number/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('number', TicketNumberPipe) number: number) {
    return this.messagesService.list(user, number);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('number', TicketNumberPipe) number: number,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(user, number, dto);
  }
}

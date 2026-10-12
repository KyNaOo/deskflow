import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { TicketNumberPipe } from './ticket-number.pipe.js';
import { TicketsService } from './tickets.service.js';

/**
 * Les tickets sont désignés par leur numéro (`/tickets/42`) : il est unique dans un tenant, et le
 * tenant vient du JWT. Le même numéro désigne donc un ticket différent dans chaque organisation.
 */
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.create(user, dto);
  }

  @Get(':number')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('number', TicketNumberPipe) number: number) {
    return this.ticketsService.findByNumber(user, number);
  }

  @Roles(Role.ADMIN, Role.AGENT)
  @Patch(':number')
  update(@Param('number', TicketNumberPipe) number: number, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(number, dto);
  }
}

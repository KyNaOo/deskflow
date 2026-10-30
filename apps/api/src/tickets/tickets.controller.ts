import {
  createTicketSchema,
  listTicketsQuerySchema,
  updateTicketSchema,
  type CreateTicketInput,
  type ListTicketsQuery,
  type UpdateTicketInput,
} from '@deskflow/shared';
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiConflictResponse } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
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
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body({ schema: createTicketSchema }) dto: CreateTicketInput,
  ) {
    return this.ticketsService.create(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query({ schema: listTicketsQuerySchema }) query: ListTicketsQuery,
  ) {
    return this.ticketsService.list(user, query);
  }

  @Get(':number')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('number', TicketNumberPipe) number: number) {
    return this.ticketsService.findByNumber(user, number);
  }

  @Roles(Role.ADMIN, Role.AGENT)
  @Patch(':number')
  @ApiConflictResponse({ description: 'Transition de statut interdite, ou ticket modifié entre-temps' })
  update(
    @Param('number', TicketNumberPipe) number: number,
    @Body({ schema: updateTicketSchema }) dto: UpdateTicketInput,
  ) {
    return this.ticketsService.update(number, dto);
  }
}

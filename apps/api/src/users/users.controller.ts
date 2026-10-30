import { inviteUserSchema, type InviteUserInput } from '@deskflow/shared';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiConflictResponse } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/client.js';
import { UsersService } from './users.service.js';

@Roles(Role.ADMIN, Role.AGENT)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post('invite')
  @ApiConflictResponse({ description: 'E-mail déjà membre de l’organisation' })
  invite(@Body({ schema: inviteUserSchema }) dto: InviteUserInput) {
    return this.usersService.invite(dto);
  }
}

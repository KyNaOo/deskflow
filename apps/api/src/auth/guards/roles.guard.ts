import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../../generated/prisma/client.js';
import type { AuthenticatedRequest } from '../authenticated-user.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/** Vérifie @Roles() : s'exécute après JwtAuthGuard, l'utilisateur est donc connu. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowedRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}

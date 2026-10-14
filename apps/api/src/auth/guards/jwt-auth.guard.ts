import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import type { TenantStore } from '../../common/tenant-store.js';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants.js';
import type { AuthenticatedRequest } from '../authenticated-user.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { TokenService } from '../token.service.js';

/**
 * Guard global : toute route exige un access token valide, sauf celles marquées @Public().
 * Une route oubliée est donc fermée par défaut plutôt qu'ouverte.
 * Dépose aussi le tenantId dans le contexte de la requête, lu par le client Prisma filtré.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly cls: ClsService<TenantStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Un socket est authentifié une fois pour toutes au handshake (RealtimeGateway)
    if (isPublic || context.getType() === 'ws') {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.tokens.verifyAccessToken(request.cookies?.[ACCESS_TOKEN_COOKIE]);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;
    this.cls.set('tenantId', user.tenantId);
    return true;
  }
}

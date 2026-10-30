import {
  acceptInvitationSchema,
  loginSchema,
  registerCustomerSchema,
  registerTenantSchema,
  type AcceptInvitationInput,
  type LoginInput,
  type RegisterCustomerInput,
  type RegisterTenantInput,
} from '@deskflow/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Env } from '../config/env.js';
import { type AuthCookieSettings, clearAuthCookies, setAuthCookies } from './auth-cookies.js';
import { REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './authenticated-user.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { TokenService } from './token.service.js';

@Controller('auth')
export class AuthController {
  private readonly cookieSettings: AuthCookieSettings;

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    config: ConfigService<Env, true>,
  ) {
    this.cookieSettings = {
      secure: config.get('NODE_ENV', { infer: true }) === 'production',
      domain: config.get('COOKIE_DOMAIN', { infer: true }),
    };
  }

  // Limité par IP sur ces deux routes seulement : 429 au-delà de AUTH_RATE_LIMIT
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register-tenant')
  @ApiTooManyRequestsResponse({ description: 'Trop de tentatives depuis cette adresse IP' })
  @ApiConflictResponse({ description: 'Slug déjà utilisé par une autre organisation' })
  async registerTenant(
    @Body({ schema: registerTenantSchema }) dto: RegisterTenantInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, ...account } = await this.authService.registerTenant(dto);
    setAuthCookies(res, tokens, this.cookieSettings);
    return account;
  }

  // Même limite que la connexion : sinon, inscription en boucle pour tester des e-mails
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register-customer')
  @ApiTooManyRequestsResponse({ description: 'Trop de tentatives depuis cette adresse IP' })
  @ApiNotFoundResponse({ description: 'Organisation introuvable' })
  @ApiConflictResponse({ description: 'Un compte existe déjà avec cet e-mail dans l’organisation' })
  async registerCustomer(
    @Body({ schema: registerCustomerSchema }) dto: RegisterCustomerInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.registerCustomer(dto);
    setAuthCookies(res, tokens, this.cookieSettings);
    return { user };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @ApiOkResponse({ description: 'Connecté : cookies de session posés' })
  @ApiTooManyRequestsResponse({ description: 'Trop de tentatives depuis cette adresse IP' })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: loginSchema }) dto: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.login(dto);
    setAuthCookies(res, tokens, this.cookieSettings);
    return { user };
  }

  // Pas de rate limiting : le jeton (256 bits aléatoires) ne se devine pas
  @Public()
  @Post('accept-invitation')
  @ApiConflictResponse({ description: 'E-mail déjà membre de l’organisation' })
  async acceptInvitation(
    @Body({ schema: acceptInvitationSchema }) dto: AcceptInvitationInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.acceptInvitation(dto);
    setAuthCookies(res, tokens, this.cookieSettings);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = readRefreshToken(req);
    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const tokens = await this.tokenService.rotateTokens(refreshToken);
    setAuthCookies(res, tokens, this.cookieSettings);
  }

  // Publique : la déconnexion doit fonctionner même si l'access token a expiré
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = readRefreshToken(req);
    if (refreshToken) {
      await this.tokenService.revokeToken(refreshToken);
    }
    clearAuthCookies(res, this.cookieSettings);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }
}

function readRefreshToken(req: Request): string | undefined {
  const token: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE];
  return typeof token === 'string' ? token : undefined;
}

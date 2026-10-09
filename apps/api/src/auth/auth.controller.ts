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
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Env } from '../config/env.js';
import { clearAuthCookies, setAuthCookies } from './auth-cookies.js';
import { REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './authenticated-user.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterTenantDto } from './dto/register-tenant.dto.js';
import { TokenService } from './token.service.js';

@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    config: ConfigService<Env, true>,
  ) {
    this.secureCookies = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  // Limité par IP sur ces deux routes seulement : 429 au-delà de AUTH_RATE_LIMIT
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register-tenant')
  async registerTenant(
    @Body() dto: RegisterTenantDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, ...account } = await this.authService.registerTenant(dto);
    setAuthCookies(res, tokens, this.secureCookies);
    return account;
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { tokens, user } = await this.authService.login(dto);
    setAuthCookies(res, tokens, this.secureCookies);
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
    setAuthCookies(res, tokens, this.secureCookies);
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
    clearAuthCookies(res, this.secureCookies);
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

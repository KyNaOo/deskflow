import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { REFRESH_TOKEN_TTL_DAYS } from './auth.constants.js';
import { generateRefreshToken, hashRefreshToken } from './refresh-token.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Contenu de l'access token : de quoi authentifier une requête sans lire la base. */
export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  role: User['role'];
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Ouvre une nouvelle session : le refresh token démarre une nouvelle famille. */
  async issueTokens(user: Pick<User, 'id' | 'tenantId' | 'role'>): Promise<AuthTokens> {
    const refreshToken = generateRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * DAY_IN_MS),
      },
    });

    const payload: AccessTokenPayload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);

    return { accessToken, refreshToken };
  }
}

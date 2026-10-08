import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Prisma, User } from '../generated/prisma/client.js';
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

type TokenOwner = Pick<User, 'id' | 'tenantId' | 'role'>;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Ouvre une nouvelle session : le refresh token démarre une nouvelle famille. */
  async issueTokens(user: TokenOwner): Promise<AuthTokens> {
    const refreshToken = await this.saveRefreshToken(this.prisma, user.id, randomUUID());
    return { accessToken: await this.signAccessToken(user), refreshToken: refreshToken.value };
  }

  /**
   * Échange un refresh token contre une nouvelle paire de jetons. Chaque refresh token
   * ne sert qu'une fois : présenter un jeton déjà utilisé signifie qu'il a été volé,
   * et toute sa famille est révoquée (l'attaquant comme l'utilisateur doivent se reconnecter).
   */
  async rotateTokens(presentedToken: string): Promise<AuthTokens> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(presentedToken) },
      include: { user: { select: { id: true, tenantId: true, role: true } } },
    });

    if (!current || current.expiresAt <= new Date()) {
      throw new UnauthorizedException();
    }
    if (current.revokedAt) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException();
    }

    const nextToken = await this.prisma.$transaction(async (tx) => {
      // Conditionnel : si une requête concurrente vient d'utiliser ce jeton, rien n'est modifié
      const { count } = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) {
        return null;
      }

      const next = await this.saveRefreshToken(tx, current.userId, current.familyId);
      await tx.refreshToken.update({ where: { id: current.id }, data: { replacedById: next.id } });
      return next.value;
    });

    if (!nextToken) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException();
    }

    return { accessToken: await this.signAccessToken(current.user), refreshToken: nextToken };
  }

  /** Déconnexion : le refresh token présenté ne pourra plus être utilisé. */
  async revokeToken(presentedToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(presentedToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async saveRefreshToken(db: Prisma.TransactionClient, userId: string, familyId: string) {
    const value = generateRefreshToken();
    const { id } = await db.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashRefreshToken(value),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * DAY_IN_MS),
      },
      select: { id: true },
    });
    return { id, value };
  }

  private signAccessToken(user: TokenOwner): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    return this.jwt.signAsync(payload);
  }
}

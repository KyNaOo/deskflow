import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { Role } from '../generated/prisma/client.js';
import { isUniqueConstraintViolation } from '../prisma/prisma-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AcceptInvitationDto } from './dto/accept-invitation.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterTenantDto } from './dto/register-tenant.dto.js';
import { publicUserSelect } from './public-user.js';
import { hashSecretToken } from './secret-token.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  /**
   * Comparé quand l'utilisateur n'existe pas : la réponse prend alors autant de temps
   * qu'avec un mauvais mot de passe, ce qui empêche de deviner quels comptes existent.
   */
  private readonly dummyPasswordHash = hash('dummy-password-for-timing');

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  /** Crée une organisation et son premier administrateur (les deux, ou aucun), puis le connecte. */
  async registerTenant(dto: RegisterTenantDto) {
    const passwordHash = await hash(dto.password);

    let account;
    try {
      account = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: dto.organizationName, slug: dto.slug },
          select: { id: true, name: true, slug: true },
        });

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: dto.name,
            email: dto.email,
            passwordHash,
            role: Role.ADMIN,
          },
          select: publicUserSelect,
        });

        return { tenant, user };
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        // Seule contrainte unique possible ici : le slug (l'utilisateur est le premier du tenant)
        throw new ConflictException('Ce slug est déjà utilisé par une autre organisation');
      }
      throw error;
    }

    const tokens = await this.tokenService.issueTokens(account.user);
    return { ...account, tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, tenant: { slug: dto.tenantSlug } },
      select: { ...publicUserSelect, passwordHash: true },
    });

    const passwordMatches = await verify(
      user?.passwordHash ?? (await this.dummyPasswordHash),
      dto.password,
    );

    // Même message dans tous les cas : ne pas révéler si l'organisation ou le compte existe
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const { passwordHash: _, ...publicUser } = user;
    const tokens = await this.tokenService.issueTokens(publicUser);
    return { user: publicUser, tokens };
  }

  /**
   * Crée le compte d'un invité dans le tenant de l'invitation, puis le connecte.
   * Client Prisma non filtré : route publique, le tenant n'est connu que par l'invitation.
   */
  async acceptInvitation(dto: AcceptInvitationDto) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashSecretToken(dto.token) },
    });

    if (!invitation) {
      throw new BadRequestException('Invitation introuvable');
    }
    if (invitation.acceptedAt) {
      throw new BadRequestException('Invitation déjà utilisée');
    }
    if (invitation.expiresAt <= new Date()) {
      throw new BadRequestException('Invitation expirée, demandez-en une nouvelle');
    }

    const passwordHash = await hash(dto.password);

    let user;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        // Conditionnel : si une requête concurrente vient d'accepter l'invitation, rien n'est modifié
        const { count } = await tx.invitation.updateMany({
          where: { id: invitation.id, acceptedAt: null },
          data: { acceptedAt: new Date() },
        });
        if (count === 0) {
          throw new BadRequestException('Invitation déjà utilisée');
        }

        return tx.user.create({
          data: {
            tenantId: invitation.tenantId,
            email: invitation.email,
            name: dto.name,
            passwordHash,
            role: invitation.role,
          },
          select: publicUserSelect,
        });
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        // Compte créé entre l'envoi de l'invitation et son acceptation
        throw new ConflictException('Cet e-mail est déjà membre de l’organisation');
      }
      throw error;
    }

    const tokens = await this.tokenService.issueTokens(user);
    return { user, tokens };
  }

  /**
   * Profil de l'utilisateur connecté (le JWT ne contient que son id, son tenant et son rôle),
   * avec son organisation : le front s'en sert pour construire ses URLs (`/acme`).
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { ...publicUserSelect, tenant: { select: { name: true, slug: true } } },
    });

    // Compte supprimé alors que son access token est encore valide
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}

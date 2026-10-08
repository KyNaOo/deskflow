import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterTenantDto } from './dto/register-tenant.dto.js';
import { publicUserSelect } from './public-user.js';
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
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

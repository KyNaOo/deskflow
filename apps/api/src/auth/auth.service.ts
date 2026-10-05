import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from '@node-rs/argon2';
import { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterTenantDto } from './dto/register-tenant.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée une organisation et son premier administrateur : les deux, ou aucun. */
  async registerTenant(dto: RegisterTenantDto) {
    const passwordHash = await hash(dto.password);

    try {
      return await this.prisma.$transaction(async (tx) => {
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
          select: { id: true, name: true, email: true, role: true },
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
  }
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

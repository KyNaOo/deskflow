import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { publicUserSelect } from '../auth/public-user.js';
import { TENANT_PRISMA, type TenantPrisma } from '../prisma/tenant-prisma.js';

/** Aucun filtre tenantId écrit ici : le client Prisma injecté l'ajoute de lui-même. */
@Injectable()
export class UsersService {
  constructor(@Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma) {}

  findAll() {
    return this.prisma.user.findMany({ select: publicUserSelect, orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });

    // Même réponse qu'un id inexistant : on ne confirme pas qu'il existe dans un autre tenant
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }
}

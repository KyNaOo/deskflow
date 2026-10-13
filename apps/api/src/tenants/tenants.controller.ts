import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Nom public d'une organisation, pour la page d'accueil de son portail client (avant toute
   * connexion). Ne renvoie rien d'autre que ce qui s'affiche sur le portail.
   */
  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { name: true, slug: true },
    });
    if (!tenant) {
      throw new NotFoundException('Organisation introuvable');
    }
    return tenant;
  }
}

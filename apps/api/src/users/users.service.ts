import type { InviteUserInput } from '@deskflow/shared';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { publicUserSelect } from '../auth/public-user.js';
import { generateSecretToken, hashSecretToken } from '../auth/secret-token.js';
import { TenantContext } from '../common/tenant-context.js';
import type { Env } from '../config/env.js';
import { EmailsService } from '../emails/emails.service.js';
import { TENANT_PRISMA, type TenantPrisma } from '../prisma/tenant-prisma.js';
import { invitationEmail } from './invitation-email.js';

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

/**
 * Aucun filtre tenantId écrit ici : le client Prisma injecté l'ajoute de lui-même.
 * Les créations prennent le tenant de TenantContext (celui du JWT).
 */
@Injectable()
export class UsersService {
  private readonly webUrl: string;

  constructor(
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
    private readonly emails: EmailsService,
    private readonly tenantContext: TenantContext,
    config: ConfigService<Env, true>,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

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

  /** Envoie par e-mail un lien à usage unique pour rejoindre l'organisation (48 h). */
  async invite(dto: InviteUserInput) {
    const member = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (member) {
      throw new ConflictException('Cet e-mail est déjà membre de l’organisation');
    }

    const token = generateSecretToken();
    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId: this.tenantContext.tenantId,
        email: dto.email,
        role: dto.role,
        tokenHash: hashSecretToken(token),
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      select: { id: true, email: true, role: true, expiresAt: true, tenant: { select: { name: true } } },
    });

    // Envoyé par le worker : l'invitation est enregistrée même si le serveur SMTP est en panne
    await this.emails.send(
      `invitation-${invitation.id}`,
      invitationEmail({
        to: invitation.email,
        organizationName: invitation.tenant.name,
        link: `${this.webUrl}/invitations/${token}`,
        expiresAt: invitation.expiresAt,
      }),
    );

    const { tenant: _, ...publicInvitation } = invitation;
    return publicInvitation;
  }
}

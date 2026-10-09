import type { MailMessage } from '../mail/mail.service.js';

interface InvitationEmail {
  to: string;
  organizationName: string;
  link: string;
  expiresAt: Date;
}

export function invitationEmail({ to, organizationName, link, expiresAt }: InvitationEmail): MailMessage {
  return {
    to,
    subject: `Invitation à rejoindre ${organizationName} sur Deskflow`,
    text: [
      'Bonjour,',
      '',
      `Vous êtes invité(e) à rejoindre l'organisation ${organizationName} sur Deskflow.`,
      'Pour créer votre compte, ouvrez ce lien :',
      '',
      link,
      '',
      `Ce lien est valable jusqu'au ${expiresAt.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} et ne peut servir qu'une fois.`,
    ].join('\n'),
  };
}

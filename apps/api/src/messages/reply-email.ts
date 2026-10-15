import type { MailMessage } from '../mail/mail.service.js';

/** Longueur maximale de l'extrait du message cité dans l'e-mail. */
export const EXCERPT_MAX_LENGTH = 300;

interface ReplyEmail {
  to: string;
  agentName: string;
  ticketNumber: number;
  ticketSubject: string;
  messageBody: string;
  link: string;
}

/**
 * Prévient le client qu'un agent lui a répondu. Texte brut uniquement : sujet et message,
 * saisis par des utilisateurs, ne sont jamais interprétés comme du HTML.
 */
export function replyEmail({ to, agentName, ticketNumber, ticketSubject, messageBody, link }: ReplyEmail): MailMessage {
  return {
    to,
    subject: `[#${ticketNumber}] ${ticketSubject}`,
    text: [
      'Bonjour,',
      '',
      `${agentName} a répondu à votre demande « ${ticketSubject} » :`,
      '',
      excerpt(messageBody)
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n'),
      '',
      'Pour lire la conversation et répondre, ouvrez ce lien :',
      link,
    ].join('\n'),
  };
}

/** Début du message, coupé sur une fin de mot, pour ne pas recopier une longue réponse. */
export function excerpt(body: string, maxLength = EXCERPT_MAX_LENGTH): string {
  const text = body.trim();
  if (text.length <= maxLength) {
    return text;
  }
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.search(/\s\S*$/);
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

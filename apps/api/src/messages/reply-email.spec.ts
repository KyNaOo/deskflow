import { EXCERPT_MAX_LENGTH, excerpt, replyEmail } from './reply-email.js';

describe('replyEmail', () => {
  const email = replyEmail({
    to: 'client@acme.test',
    agentName: 'Alice',
    ticketNumber: 42,
    ticketSubject: 'Imprimante HS',
    messageBody: 'Bonjour,\nredémarrez-la.',
    link: 'http://localhost:3000/portal/acme/tickets/42',
  });

  it('adresse l’e-mail au client avec le numéro et le sujet du ticket', () => {
    expect(email.to).toBe('client@acme.test');
    expect(email.subject).toBe('[#42] Imprimante HS');
  });

  it('cite le message ligne par ligne et donne le lien vers le portail', () => {
    expect(email.text).toContain('Alice a répondu à votre demande « Imprimante HS »');
    expect(email.text).toContain('> Bonjour,\n> redémarrez-la.');
    expect(email.text).toContain('http://localhost:3000/portal/acme/tickets/42');
  });

  it('reste en texte brut : du HTML saisi par un utilisateur est recopié tel quel', () => {
    const { text } = replyEmail({
      to: 'client@acme.test',
      agentName: 'Alice',
      ticketNumber: 1,
      ticketSubject: '<b>Urgent</b>',
      messageBody: '<script>alert(1)</script>',
      link: 'http://localhost:3000/portal/acme/tickets/1',
    });
    expect(text).toContain('> <script>alert(1)</script>');
    expect(text).not.toContain('&lt;');
  });
});

describe('excerpt', () => {
  it('garde un message court en entier, sans espaces superflus', () => {
    expect(excerpt('  Merci !  ')).toBe('Merci !');
  });

  it('coupe un long message sur une fin de mot et ajoute des points de suspension', () => {
    const body = 'mot '.repeat(200);

    const result = excerpt(body);

    expect(result.length).toBeLessThanOrEqual(EXCERPT_MAX_LENGTH + 1);
    expect(result).toMatch(/ mot…$/);
  });

  it('coupe net un mot plus long que la limite', () => {
    expect(excerpt('a'.repeat(20), 10)).toBe(`${'a'.repeat(10)}…`);
  });
});

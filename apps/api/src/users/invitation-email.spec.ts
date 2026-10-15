import { invitationEmail } from './invitation-email.js';

describe('invitationEmail', () => {
  it('contient l’organisation, le lien à usage unique et sa date d’expiration', () => {
    const email = invitationEmail({
      to: 'milton@initech.test',
      organizationName: 'Initech',
      link: 'http://localhost:3000/invitations/abc',
      expiresAt: new Date('2026-10-17T08:00:00Z'),
    });

    expect(email.to).toBe('milton@initech.test');
    expect(email.subject).toBe('Invitation à rejoindre Initech sur Deskflow');
    expect(email.text).toContain('http://localhost:3000/invitations/abc');
    // Heure de Paris, quel que soit le fuseau du serveur
    expect(email.text).toContain('17/10/2026 10:00:00');
  });
});

import { canTransition } from '@deskflow/shared';
import { automaticTransition } from './automatic-transition.js';

describe('automaticTransition', () => {
  it('réponse publique d’un agent : OPEN → PENDING', () => {
    expect(automaticTransition(false, false)).toEqual({ from: ['OPEN'], to: 'PENDING' });
  });

  it('réponse du client : PENDING ou RESOLVED → OPEN', () => {
    expect(automaticTransition(true, false)).toEqual({ from: ['PENDING', 'RESOLVED'], to: 'OPEN' });
  });

  it('note interne : aucun changement de statut', () => {
    expect(automaticTransition(false, true)).toBeNull();
  });

  it.each([
    ['un agent', false],
    ['un client', true],
  ])('les transitions automatiques après un message d’%s respectent la machine à états', (_who, isCustomer) => {
    const transition = automaticTransition(isCustomer, false)!;

    for (const from of transition.from) {
      expect(canTransition(from, transition.to)).toBe(true);
    }
  });
});

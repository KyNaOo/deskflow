import { ConflictException } from '@nestjs/common';
import { transitionData } from './ticket-transition.js';

const now = new Date('2026-10-12T10:00:00Z');

describe('transitionData', () => {
  it('pose resolvedAt en passant à RESOLVED', () => {
    expect(transitionData('OPEN', 'RESOLVED', now)).toEqual({ status: 'RESOLVED', resolvedAt: now });
    expect(transitionData('PENDING', 'RESOLVED', now)).toEqual({ status: 'RESOLVED', resolvedAt: now });
  });

  it('efface resolvedAt à la réouverture', () => {
    expect(transitionData('RESOLVED', 'OPEN', now)).toEqual({ status: 'OPEN', resolvedAt: null });
  });

  it('conserve resolvedAt à la clôture d’un ticket résolu', () => {
    expect(transitionData('RESOLVED', 'CLOSED', now)).toEqual({ status: 'CLOSED' });
  });

  it('ne touche pas resolvedAt pour les autres transitions', () => {
    expect(transitionData('OPEN', 'PENDING', now)).toEqual({ status: 'PENDING' });
    expect(transitionData('PENDING', 'OPEN', now)).toEqual({ status: 'OPEN' });
  });

  it('refuse une transition interdite (409) avec un message explicite', () => {
    expect(() => transitionData('RESOLVED', 'PENDING', now)).toThrow(
      new ConflictException('Transition interdite : RESOLVED → PENDING'),
    );
    expect(() => transitionData('CLOSED', 'OPEN', now)).toThrow(ConflictException);
  });
});

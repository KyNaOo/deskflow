import { AUTO_CLOSE_AFTER_DAYS, autoCloseCutoff } from './auto-close.js';

describe('autoCloseCutoff', () => {
  it(`renvoie la date d'il y a ${AUTO_CLOSE_AFTER_DAYS} jours, à la milliseconde près`, () => {
    expect(autoCloseCutoff(new Date('2026-10-15T10:30:00.123Z'))).toEqual(
      new Date('2026-10-08T10:30:00.123Z'),
    );
  });

  it('ne dépend pas du fuseau : un passage à l’heure d’hiver ne décale pas la limite', () => {
    // Changement d'heure en France le 25/10/2026 : 7 jours font toujours 168 heures
    const now = new Date('2026-10-28T12:00:00Z');
    expect(now.getTime() - autoCloseCutoff(now).getTime()).toBe(168 * 3600 * 1000);
  });
});

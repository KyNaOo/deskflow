import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, analyticsQuerySchema, analyticsToday, daysInPeriod } from './analytics.js';

describe('analyticsQuerySchema', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 22 h UTC le 21 octobre : déjà le 22 octobre à Paris
    vi.setSystemTime(new Date('2026-10-21T22:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('vaut par défaut les 30 derniers jours, aujourd’hui compris, à l’heure de Paris', () => {
    expect(analyticsQuerySchema.parse({})).toEqual({ from: '2026-09-23', to: '2026-10-22' });
  });

  it('ignore les paramètres vides, comme les filtres de la liste des tickets', () => {
    expect(analyticsQuerySchema.parse({ from: '', to: '' })).toEqual({ from: '2026-09-23', to: '2026-10-22' });
  });

  it('accepte une période explicite, d’un seul jour comme de 90 jours', () => {
    expect(analyticsQuerySchema.parse({ from: '2026-10-01', to: '2026-10-01' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-01',
    });
    expect(analyticsQuerySchema.safeParse({ from: '2026-07-24', to: '2026-10-21' }).success).toBe(true);
  });

  it('compte 30 jours avant `to` quand seul `to` est donné', () => {
    expect(analyticsQuerySchema.parse({ to: '2026-03-31' })).toEqual({ from: '2026-03-02', to: '2026-03-31' });
  });

  it('refuse une période inversée', () => {
    const result = analyticsQuerySchema.safeParse({ from: '2026-10-10', to: '2026-10-01' });
    expect(result.error?.issues[0]?.message).toBe('La date de début doit précéder la date de fin');
  });

  it('refuse une période de plus de 90 jours', () => {
    const result = analyticsQuerySchema.safeParse({ from: '2026-07-23', to: '2026-10-21' });
    expect(result.error?.issues[0]?.message).toBe('Période de 90 jours au plus');
  });

  it('refuse une date mal formée ou un paramètre inconnu', () => {
    expect(analyticsQuerySchema.safeParse({ from: '21/10/2026' }).success).toBe(false);
    expect(analyticsQuerySchema.safeParse({ from: '2026-02-30' }).success).toBe(false);
    expect(analyticsQuerySchema.safeParse({ days: '30' }).success).toBe(false);
  });
});

describe('calcul sur les jours', () => {
  it('analyticsToday donne le jour de Paris, pas celui d’UTC', () => {
    expect(analyticsToday(new Date('2026-10-21T21:59:00Z'))).toBe('2026-10-21');
    expect(analyticsToday(new Date('2026-10-21T22:00:00Z'))).toBe('2026-10-22');
  });

  it('addDays traverse fins de mois et changements d’heure sans décalage', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('daysInPeriod compte les deux bornes', () => {
    expect(daysInPeriod({ from: '2026-10-01', to: '2026-10-01' })).toBe(1);
    expect(daysInPeriod({ from: '2026-10-01', to: '2026-10-31' })).toBe(31);
  });
});

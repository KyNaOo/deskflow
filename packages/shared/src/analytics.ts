import { z } from 'zod';
import { urlParam } from './fields.js';
import type { TicketStatus } from './tickets.js';

/** Fuseau des indicateurs : un « jour » commence à minuit, heure de Paris. */
export const ANALYTICS_TIME_ZONE = 'Europe/Paris';
export const DEFAULT_ANALYTICS_DAYS = 30;
export const MAX_ANALYTICS_DAYS = 90;

/** Période en jours calendaires (`AAAA-MM-JJ`), bornes comprises. */
export interface AnalyticsPeriod {
  from: string;
  to: string;
}

/** Jour courant (`AAAA-MM-JJ`) dans le fuseau des indicateurs. */
export function analyticsToday(now = new Date()): string {
  // Le format canadien anglais est justement AAAA-MM-JJ
  return new Intl.DateTimeFormat('en-CA', { timeZone: ANALYTICS_TIME_ZONE }).format(now);
}

/** Calcul sur des jours calendaires, en UTC : aucun changement d'heure ne décale le résultat. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Nombre de jours d'une période, bornes comprises. */
export function daysInPeriod({ from, to }: AnalyticsPeriod): number {
  return (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
}

const day = urlParam(z.iso.date('Date invalide : AAAA-MM-JJ attendu'));

/**
 * Période des indicateurs (`GET /analytics/overview?from=&to=`), en jours calendaires inclus.
 * Par défaut : les 30 derniers jours, aujourd'hui compris.
 */
export const analyticsQuerySchema = z
  .strictObject({ from: day, to: day })
  .transform(({ from, to = analyticsToday() }): AnalyticsPeriod => ({
    from: from ?? addDays(to, -(DEFAULT_ANALYTICS_DAYS - 1)),
    to,
  }))
  .refine(({ from, to }) => from <= to, {
    message: 'La date de début doit précéder la date de fin',
    path: ['from'],
  })
  .refine((period) => daysInPeriod(period) <= MAX_ANALYTICS_DAYS, {
    message: `Période de ${MAX_ANALYTICS_DAYS} jours au plus`,
    path: ['from'],
  });

/** Réponse de `GET /analytics/overview` : durées en secondes, `null` sans aucune donnée. */
export interface AnalyticsOverview {
  period: AnalyticsPeriod;
  /** Indicateurs des tickets créés pendant la période */
  ticketsCreated: number;
  /** Parmi eux, ceux qui attendent encore une première réponse d'un agent */
  unanswered: number;
  medianFirstResponseSeconds: number | null;
  medianResolutionSeconds: number | null;
  /** Un élément par jour de la période, jours sans ticket compris */
  createdPerDay: { day: string; count: number }[];
  /** Répartition actuelle de tous les tickets, indépendante de la période */
  byStatus: Record<TicketStatus, number>;
}

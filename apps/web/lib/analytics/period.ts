import { addDays, analyticsToday, type AnalyticsPeriod } from "@deskflow/shared";

/** Périodes proposées sur le dashboard, en jours (aujourd'hui compris). */
export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];

const DEFAULT_PERIOD: PeriodDays = 30;

type SearchParams = Record<string, string | string[] | undefined>;

/** `?period=7` → 7 ; valeur absente ou invalide (URL modifiée à la main) → 30 jours. */
export function parsePeriod(searchParams: SearchParams): PeriodDays {
  const raw = searchParams.period;
  const days = Number(Array.isArray(raw) ? raw[0] : raw);
  return PERIOD_OPTIONS.find((option) => option === days) ?? DEFAULT_PERIOD;
}

/** Les `days` derniers jours, aujourd'hui compris, au format attendu par l'API. */
export function periodRange(days: PeriodDays, today = analyticsToday()): AnalyticsPeriod {
  return { from: addDays(today, -(days - 1)), to: today };
}

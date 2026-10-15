/** Un ticket résolu sans nouvelle du client depuis ce délai est clos automatiquement. */
export const AUTO_CLOSE_AFTER_DAYS = 7;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** Date limite : un ticket résolu avant elle doit être clos. */
export function autoCloseCutoff(now: Date): Date {
  return new Date(now.getTime() - AUTO_CLOSE_AFTER_DAYS * DAY_IN_MS);
}

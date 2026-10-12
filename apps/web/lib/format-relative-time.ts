const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
const dateOnly = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });

/**
 * « il y a 5 minutes », « hier », puis la date au-delà d'un mois. Une durée relative s'affiche
 * pareil quel que soit le fuseau du serveur qui rend la page, contrairement à une heure.
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const elapsed = now.getTime() - date.getTime();

  if (elapsed < MINUTE) {
    return "à l’instant";
  }
  if (elapsed < HOUR) {
    return relative.format(-Math.floor(elapsed / MINUTE), "minute");
  }
  if (elapsed < DAY) {
    return relative.format(-Math.floor(elapsed / HOUR), "hour");
  }
  if (elapsed < 30 * DAY) {
    return relative.format(-Math.floor(elapsed / DAY), "day");
  }
  return dateOnly.format(date);
}

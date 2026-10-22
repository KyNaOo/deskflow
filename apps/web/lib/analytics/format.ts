const MINUTE = 60;
const HOUR = 60 * MINUTE;

/**
 * Délai lisible, à la précision utile pour un indicateur : « 45 min », « 2 h 15 min », « 3 j 4 h ».
 * Au-delà d'une heure, les minutes sont arrondies ; au-delà d'un jour, les heures.
 */
export function formatDuration(seconds: number): string {
  if (seconds < MINUTE) {
    return "moins d’une minute";
  }
  // Arrondi avant de choisir l'unité : 59 min 40 s s'affiche « 1 h », pas « 60 min »
  const totalMinutes = Math.round(seconds / MINUTE);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  if (totalMinutes < 24 * 60) {
    return joinUnits(Math.floor(totalMinutes / 60), "h", totalMinutes % 60, "min");
  }
  const totalHours = Math.round(seconds / HOUR);
  return joinUnits(Math.floor(totalHours / 24), "j", totalHours % 24, "h");
}

function joinUnits(major: number, majorUnit: string, minor: number, minorUnit: string): string {
  return minor === 0 ? `${major} ${majorUnit}` : `${major} ${majorUnit} ${minor} ${minorUnit}`;
}

/** « 1 ticket », « 3 tickets » */
export function ticketCount(count: number): string {
  return `${count} ticket${count > 1 ? "s" : ""}`;
}

const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** `2026-10-22` → « 22 oct. » (axe des graphiques). Un jour calendaire : lu en UTC, sans décalage. */
export function formatShortDay(day: string): string {
  return shortDay.format(new Date(`${day}T00:00:00Z`));
}

/** `2026-10-22` → « jeudi 22 octobre » (infobulle, tableau). */
export function formatLongDay(day: string): string {
  return longDay.format(new Date(`${day}T00:00:00Z`));
}

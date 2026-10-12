import { formatRelativeTime } from "@/lib/format-relative-time";

/** Date relative (« il y a 3 heures ») ; la date exacte reste lisible par les outils d'accessibilité. */
export function RelativeTime({ date }: { date: string }) {
  return <time dateTime={date}>{formatRelativeTime(new Date(date))}</time>;
}

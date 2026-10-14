import { formatRelativeTime } from "@/lib/format-relative-time";

/** Date relative (« il y a 3 heures ») ; la date exacte reste lisible par les outils d'accessibilité. */
export function RelativeTime({ date }: { date: string }) {
  // Rendue aussi dans des composants clients : le texte peut changer d'une minute entre le rendu
  // serveur et l'hydratation, sans que ce soit une erreur
  return (
    <time dateTime={date} suppressHydrationWarning>
      {formatRelativeTime(new Date(date))}
    </time>
  );
}

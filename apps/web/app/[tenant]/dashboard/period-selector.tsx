import Link from "next/link";
import { PERIOD_OPTIONS, type PeriodDays } from "@/lib/analytics/period";
import { cn } from "@/lib/utils";

/**
 * Choix de la période : de simples liens, la période vit dans l'URL comme les filtres des tickets.
 * Aucun JavaScript côté navigateur : chaque choix est une navigation, relue par le Server Component.
 */
export function PeriodSelector({ basePath, current }: { basePath: string; current: PeriodDays }) {
  return (
    <nav aria-label="Période">
      <ul className="flex rounded-lg border p-0.5 text-sm">
        {PERIOD_OPTIONS.map((days) => (
          <li key={days}>
            <Link
              href={`${basePath}?period=${days}`}
              aria-current={days === current ? "page" : undefined}
              className={cn(
                "block rounded-md px-3 py-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                days === current ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {days} jours
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

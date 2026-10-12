import { Skeleton } from "@/components/ui/skeleton";

/** Affiché pendant le chargement de la liste (première visite ou changement de filtre). */
export default function TicketsLoading() {
  return (
    <div role="status" aria-label="Chargement des tickets" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-14 w-full" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

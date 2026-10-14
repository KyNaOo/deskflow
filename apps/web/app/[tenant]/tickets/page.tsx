import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { serverFetch } from "@/lib/api/server";
import type { Member, TicketPage } from "@/lib/api/types";
import { hasActiveFilters, parseFilters, toSearchParams } from "@/lib/tickets/filters";
import { TicketFiltersForm } from "./ticket-filters-form";
import { TicketListUpdates } from "./ticket-list-updates";
import { TicketTable } from "./ticket-table";

export const metadata: Metadata = { title: "Tickets · Deskflow" };

/**
 * Server Component : les tickets arrivent avec le HTML, sans appel API depuis le navigateur.
 * Les filtres vivent dans l'URL : chaque changement de filtre est une nouvelle navigation.
 */
export default async function TicketsPage({ params, searchParams }: PageProps<"/[tenant]/tickets">) {
  const { tenant } = await params;
  const filters = parseFilters(await searchParams);

  const [page, members] = await Promise.all([
    serverFetch<TicketPage>(`/tickets?${toSearchParams(filters)}`),
    serverFetch<Member[]>("/users"),
  ]);
  const agents = members.filter((member) => member.role !== "CUSTOMER");
  const basePath = `/${tenant}/tickets`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <Button asChild>
          <Link href={`${basePath}/new`}>Nouveau ticket</Link>
        </Button>
      </div>

      <TicketFiltersForm filters={filters} agents={agents} />
      <TicketListUpdates />

      {page.items.length > 0 ? (
        <TicketTable tickets={page.items} basePath={basePath} />
      ) : (
        <p role="status" className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          {hasActiveFilters(filters) ? "Aucun ticket ne correspond à ces filtres." : "Aucun ticket pour le moment."}
        </p>
      )}

      {/* Pagination par curseur : on avance page par page, ou on revient au début */}
      <nav aria-label="Pagination" className="flex justify-end gap-2">
        {filters.cursor && (
          <Button asChild variant="outline" size="sm">
            <Link href={`${basePath}?${toSearchParams({ ...filters, cursor: undefined })}`}>Première page</Link>
          </Button>
        )}
        {page.nextCursor && (
          <Button asChild variant="outline" size="sm">
            <Link href={`${basePath}?${toSearchParams({ ...filters, cursor: page.nextCursor })}`}>Page suivante</Link>
          </Button>
        )}
      </nav>
    </div>
  );
}

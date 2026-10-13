import type { Metadata } from "next";
import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";
import { StatusBadge } from "@/components/tickets/ticket-badges";
import { Button } from "@/components/ui/button";
import { serverFetch } from "@/lib/api/server";
import type { TicketPage } from "@/lib/api/types";
import { parseFilters, toSearchParams } from "@/lib/tickets/filters";

export const metadata: Metadata = { title: "Mes demandes · Assistance" };

/** GET /tickets ne renvoie à un client que ses propres tickets : aucune route dédiée. */
export default async function CustomerTicketsPage({ params, searchParams }: PageProps<"/portal/[tenant]/tickets">) {
  const { tenant } = await params;
  const { cursor } = parseFilters(await searchParams);
  const page = await serverFetch<TicketPage>(`/tickets?${toSearchParams({ cursor })}`);
  const basePath = `/portal/${tenant}/tickets`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Mes demandes</h1>
        <Button asChild>
          <Link href={`${basePath}/new`}>Nouvelle demande</Link>
        </Button>
      </div>

      {page.items.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg border bg-background">
          {page.items.map((ticket) => (
            <li key={ticket.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
              <span className="text-sm text-muted-foreground">#{ticket.number}</span>
              <Link href={`${basePath}/${ticket.number}`} className="font-medium hover:underline">
                {ticket.subject}
              </Link>
              <span className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
                <StatusBadge status={ticket.status} />
                <RelativeTime date={ticket.updatedAt} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="rounded-lg border border-dashed bg-background p-8 text-center text-muted-foreground">
          Vous n’avez encore ouvert aucune demande.
        </p>
      )}

      <nav aria-label="Pagination" className="flex justify-end gap-2">
        {cursor && (
          <Button asChild variant="outline" size="sm">
            <Link href={basePath}>Première page</Link>
          </Button>
        )}
        {page.nextCursor && (
          <Button asChild variant="outline" size="sm">
            <Link href={`${basePath}?${toSearchParams({ cursor: page.nextCursor })}`}>Page suivante</Link>
          </Button>
        )}
      </nav>
    </div>
  );
}

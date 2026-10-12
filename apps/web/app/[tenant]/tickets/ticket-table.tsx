import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";
import { PriorityBadge, StatusBadge } from "@/components/tickets/ticket-badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Ticket } from "@/lib/api/types";

export function TicketTable({ tickets, basePath }: { tickets: Ticket[]; basePath: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">N°</TableHead>
          <TableHead>Sujet</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Priorité</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Assigné à</TableHead>
          <TableHead>Mis à jour</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell className="text-muted-foreground">#{ticket.number}</TableCell>
            <TableCell className="max-w-80 truncate font-medium">
              {/* Un seul lien par ligne, sur le sujet : un arrêt de tabulation par ticket */}
              <Link href={`${basePath}/${ticket.number}`} className="hover:underline">
                {ticket.subject}
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge status={ticket.status} />
            </TableCell>
            <TableCell>
              <PriorityBadge priority={ticket.priority} />
            </TableCell>
            <TableCell>{ticket.customer.name}</TableCell>
            <TableCell className={ticket.assignee ? undefined : "text-muted-foreground"}>
              {ticket.assignee?.name ?? "Non assigné"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              <RelativeTime date={ticket.updatedAt} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

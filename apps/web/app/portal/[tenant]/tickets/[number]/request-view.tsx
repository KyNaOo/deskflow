"use client";

import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";
import { Conversation } from "@/components/tickets/conversation";
import { StatusBadge } from "@/components/tickets/ticket-badges";
import type { Message, Ticket } from "@/lib/api/types";
import { useLiveTicket } from "@/lib/tickets/use-live-ticket";

interface RequestViewProps {
  tenant: string;
  initialTicket: Ticket;
  initialMessages: Message[];
  currentUser: Message["author"];
}

/** Demande d'un client, tenue à jour en temps réel : les réponses de l'équipe arrivent sans recharger. */
export function RequestView({ tenant, initialTicket, initialMessages, currentUser }: RequestViewProps) {
  const { ticket, messages } = useLiveTicket(initialTicket, initialMessages);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/portal/${tenant}/tickets`} className="text-sm text-muted-foreground hover:underline">
          ← Mes demandes
        </Link>
        <h1 className="text-2xl font-semibold">
          <span className="text-muted-foreground">#{ticket.number}</span> {ticket.subject}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge status={ticket.status} />
          <span>
            Ouverte <RelativeTime date={ticket.createdAt} />
          </span>
        </div>
      </div>

      <Conversation
        ticket={ticket}
        messages={messages}
        author={currentUser}
        closedNotice="Cette demande est close. Pour un nouveau problème, ouvrez une nouvelle demande."
      />
    </div>
  );
}

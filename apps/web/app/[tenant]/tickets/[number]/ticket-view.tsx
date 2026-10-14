"use client";

import Link from "next/link";
import { RelativeTime } from "@/components/relative-time";
import { Conversation } from "@/components/tickets/conversation";
import { PriorityBadge, StatusBadge } from "@/components/tickets/ticket-badges";
import type { Member, Message, Ticket } from "@/lib/api/types";
import { useLiveTicket } from "@/lib/tickets/use-live-ticket";
import { TicketActions } from "./ticket-actions";

interface TicketViewProps {
  tenant: string;
  initialTicket: Ticket;
  initialMessages: Message[];
  agents: Pick<Member, "id" | "name">[];
  currentUser: Message["author"];
}

/** Détail d'un ticket côté agents, tenu à jour en temps réel (messages, statut, assignation). */
export function TicketView({ tenant, initialTicket, initialMessages, agents, currentUser }: TicketViewProps) {
  const { ticket, messages } = useLiveTicket(initialTicket, initialMessages);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/${tenant}/tickets`} className="text-sm text-muted-foreground hover:underline">
          ← Tickets
        </Link>
        <h1 className="text-2xl font-semibold">
          <span className="text-muted-foreground">#{ticket.number}</span> {ticket.subject}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <span>
            Ouvert par {ticket.customer.name} <RelativeTime date={ticket.createdAt} />
          </span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <section aria-labelledby="conversation-title" className="flex flex-col gap-6">
          <h2 id="conversation-title" className="sr-only">
            Conversation
          </h2>
          <Conversation
            ticket={ticket}
            messages={messages}
            author={currentUser}
            allowInternalNote
            closedNotice="Ce ticket est clos : il n’est plus possible d’y répondre."
          />
        </section>

        <aside aria-label="Informations et actions" className="flex flex-col gap-6">
          <TicketActions ticket={ticket} agents={agents} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Client</dt>
            <dd>
              {ticket.customer.name}
              <br />
              <span className="text-muted-foreground">{ticket.customer.email}</span>
            </dd>
            <dt className="text-muted-foreground">1re réponse</dt>
            <dd>{ticket.firstResponseAt ? <RelativeTime date={ticket.firstResponseAt} /> : "Pas encore"}</dd>
            {ticket.resolvedAt && (
              <>
                <dt className="text-muted-foreground">Résolu</dt>
                <dd>
                  <RelativeTime date={ticket.resolvedAt} />
                </dd>
              </>
            )}
          </dl>
        </aside>
      </div>
    </div>
  );
}

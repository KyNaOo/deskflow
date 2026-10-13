import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RelativeTime } from "@/components/relative-time";
import { MessageThread } from "@/components/tickets/message-thread";
import { ReplyForm } from "@/components/tickets/reply-form";
import { PriorityBadge, StatusBadge } from "@/components/tickets/ticket-badges";
import { serverFetch } from "@/lib/api/server";
import type { Member, Message, Ticket } from "@/lib/api/types";
import { TicketActions } from "./ticket-actions";

export async function generateMetadata({ params }: PageProps<"/[tenant]/tickets/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: `Ticket #${number} · Deskflow` };
}

/** Détail d'un ticket : lu côté serveur, les actions (client) relisent la page après chaque modification. */
export default async function TicketPage({ params }: PageProps<"/[tenant]/tickets/[number]">) {
  const { tenant, number } = await params;
  if (!/^[1-9]\d{0,9}$/.test(number)) {
    notFound();
  }

  const [ticket, messages, members] = await Promise.all([
    serverFetch<Ticket>(`/tickets/${number}`),
    serverFetch<Message[]>(`/tickets/${number}/messages`),
    serverFetch<Member[]>("/users"),
  ]);
  const agents = members.filter((member) => member.role !== "CUSTOMER");

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
          <MessageThread messages={messages} />
          {ticket.status === "CLOSED" ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Ce ticket est clos : il n’est plus possible d’y répondre.
            </p>
          ) : (
            <ReplyForm ticketNumber={ticket.number} allowInternalNote />
          )}
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

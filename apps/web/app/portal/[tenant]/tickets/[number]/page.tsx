import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RelativeTime } from "@/components/relative-time";
import { MessageThread } from "@/components/tickets/message-thread";
import { ReplyForm } from "@/components/tickets/reply-form";
import { StatusBadge } from "@/components/tickets/ticket-badges";
import { serverFetch } from "@/lib/api/server";
import type { Message, Ticket } from "@/lib/api/types";

export async function generateMetadata({ params }: PageProps<"/portal/[tenant]/tickets/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: `Demande #${number} · Assistance` };
}

/** Conversation côté client : l'API ne lui renvoie jamais les notes internes. */
export default async function CustomerTicketPage({ params }: PageProps<"/portal/[tenant]/tickets/[number]">) {
  const { tenant, number } = await params;
  if (!/^[1-9]\d{0,9}$/.test(number)) {
    notFound();
  }

  const [ticket, messages] = await Promise.all([
    serverFetch<Ticket>(`/tickets/${number}`),
    serverFetch<Message[]>(`/tickets/${number}/messages`),
  ]);

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

      <MessageThread messages={messages} />
      {ticket.status === "CLOSED" ? (
        <p className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
          Cette demande est close. Pour un nouveau problème, ouvrez une nouvelle demande.
        </p>
      ) : (
        <ReplyForm ticketNumber={ticket.number} />
      )}
    </div>
  );
}

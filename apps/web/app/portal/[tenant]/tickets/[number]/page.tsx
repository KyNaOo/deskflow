import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/api/profile";
import { serverFetch } from "@/lib/api/server";
import type { Message, Ticket } from "@/lib/api/types";
import { RequestView } from "./request-view";

export async function generateMetadata({ params }: PageProps<"/portal/[tenant]/tickets/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: `Demande #${number} · Assistance` };
}

/** Conversation côté client : l'API ne lui renvoie jamais les notes internes (ni en REST, ni en temps réel). */
export default async function CustomerTicketPage({ params }: PageProps<"/portal/[tenant]/tickets/[number]">) {
  const { tenant, number } = await params;
  if (!/^[1-9]\d{0,9}$/.test(number)) {
    notFound();
  }

  const [ticket, messages, profile] = await Promise.all([
    serverFetch<Ticket>(`/tickets/${number}`),
    serverFetch<Message[]>(`/tickets/${number}/messages`),
    getProfile(),
  ]);

  return (
    <RequestView
      key={ticket.id}
      tenant={tenant}
      initialTicket={ticket}
      initialMessages={messages}
      currentUser={{ id: profile.id, name: profile.name, role: profile.role }}
    />
  );
}

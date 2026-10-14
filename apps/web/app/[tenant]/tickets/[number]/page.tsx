import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/api/profile";
import { serverFetch } from "@/lib/api/server";
import type { Member, Message, Ticket } from "@/lib/api/types";
import { TicketView } from "./ticket-view";

export async function generateMetadata({ params }: PageProps<"/[tenant]/tickets/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: `Ticket #${number} · Deskflow` };
}

/**
 * Détail d'un ticket : les données arrivent avec le HTML (Server Component), puis le composant
 * client les garde à jour en temps réel.
 */
export default async function TicketPage({ params }: PageProps<"/[tenant]/tickets/[number]">) {
  const { tenant, number } = await params;
  if (!/^[1-9]\d{0,9}$/.test(number)) {
    notFound();
  }

  const [ticket, messages, members, profile] = await Promise.all([
    serverFetch<Ticket>(`/tickets/${number}`),
    serverFetch<Message[]>(`/tickets/${number}/messages`),
    serverFetch<Member[]>("/users"),
    getProfile(),
  ]);
  const agents = members.filter((member) => member.role !== "CUSTOMER");

  return (
    <TicketView
      // Un autre ticket repart de ses propres données serveur
      key={ticket.id}
      tenant={tenant}
      initialTicket={ticket}
      initialMessages={messages}
      agents={agents}
      currentUser={{ id: profile.id, name: profile.name, role: profile.role }}
    />
  );
}

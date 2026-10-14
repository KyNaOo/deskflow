import type { Message, Ticket } from "@deskflow/shared";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useTicketSocket } from "@/lib/realtime/use-ticket-socket";
import type { ThreadMessage } from "./message-cache";
import { ticketKeys } from "./query-keys";

/**
 * Données lues par le Server Component (initialData), puis tenues à jour par le WebSocket :
 * jamais périmées tant que la page est ouverte (staleTime), donc aucun second chargement.
 * Oubliées dès que la page est quittée (gcTime 0) : en revenant, ce sont les données fraîches
 * du serveur qui servent, pas une copie restée en cache.
 */
const liveQueryOptions = { staleTime: Infinity, gcTime: 0 } as const;

/** Ticket et conversation, mis à jour en temps réel. */
export function useLiveTicket(initialTicket: Ticket, initialMessages: Message[]) {
  const { number } = initialTicket;

  const { data: ticket } = useQuery({
    queryKey: ticketKeys.detail(number),
    queryFn: () => apiFetch<Ticket>(`/tickets/${number}`),
    initialData: initialTicket,
    ...liveQueryOptions,
  });
  const { data: messages } = useQuery<ThreadMessage[]>({
    queryKey: ticketKeys.messages(number),
    queryFn: () => apiFetch<Message[]>(`/tickets/${number}/messages`),
    initialData: initialMessages,
    ...liveQueryOptions,
  });

  useTicketSocket(ticket.id, number);
  return { ticket, messages };
}

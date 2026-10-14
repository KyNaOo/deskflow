import type { MessageCreatedEvent, Ticket } from "@deskflow/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { addMessage, type ThreadMessage } from "@/lib/tickets/message-cache";
import { ticketKeys } from "@/lib/tickets/query-keys";
import { acquireSocket } from "./socket";

/**
 * Suit un ticket en temps réel : rejoint sa room tant que le composant est affiché et reporte
 * les événements dans le cache TanStack Query (conversation, statut, priorité, assignation).
 */
export function useTicketSocket(ticketId: string, ticketNumber: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { socket, release } = acquireSocket();
    let joinedBefore = false;

    // À chaque connexion : une reconnexion ouvre un nouveau socket côté serveur, sans ses rooms
    function join() {
      void socket.emitWithAck("ticket.join", { ticketId });
      if (joinedBefore) {
        // Des événements ont pu être manqués pendant la coupure : on relit ticket et conversation
        void queryClient.invalidateQueries({ queryKey: ticketKeys.detail(ticketNumber) });
      }
      joinedBefore = true;
    }

    function onMessageCreated({ ticketId: id, message }: MessageCreatedEvent) {
      if (id !== ticketId) return;
      queryClient.setQueryData<ThreadMessage[]>(ticketKeys.messages(ticketNumber), (messages = []) =>
        addMessage(messages, message),
      );
    }

    function onTicketUpdated(ticket: Ticket) {
      if (ticket.id !== ticketId) return;
      queryClient.setQueryData(ticketKeys.detail(ticketNumber), ticket);
    }

    socket.on("connect", join);
    socket.on("message.created", onMessageCreated);
    socket.on("ticket.updated", onTicketUpdated);
    if (socket.connected) {
      join();
    }

    return () => {
      socket.off("connect", join);
      socket.off("message.created", onMessageCreated);
      socket.off("ticket.updated", onTicketUpdated);
      if (socket.connected) {
        socket.emit("ticket.leave", { ticketId });
      }
      release();
    };
  }, [queryClient, ticketId, ticketNumber]);
}

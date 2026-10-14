import type { AgentTypingEvent, MessageCreatedEvent } from "@deskflow/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { acquireSocket, type RealtimeSocket } from "./socket";
import { shouldSignalTyping, startTyping, stopTyping, type TypingAgent, withoutExpired } from "./typing";

/** Agents en train d'écrire sur ce ticket (hors utilisateur courant, connecté dans un autre onglet). */
export function useTypingAgents(ticketId: string, currentUserId: string): TypingAgent[] {
  const [agents, setAgents] = useState<TypingAgent[]>([]);

  useEffect(() => {
    const { socket, release } = acquireSocket();

    function onTyping(event: AgentTypingEvent) {
      if (event.ticketId !== ticketId || event.agent.id === currentUserId) return;
      setAgents((current) => startTyping(current, event, Date.now()));
    }
    function onMessage({ ticketId: id, message }: MessageCreatedEvent) {
      if (id !== ticketId) return;
      setAgents((current) => stopTyping(current, message.author.id));
    }

    socket.on("agent.typing", onTyping);
    socket.on("message.created", onMessage);
    return () => {
      socket.off("agent.typing", onTyping);
      socket.off("message.created", onMessage);
      release();
    };
  }, [ticketId, currentUserId]);

  // Masque chaque agent à l'expiration de son délai, sans attendre de nouvel événement
  useEffect(() => {
    if (agents.length === 0) return;
    const nextExpiry = Math.min(...agents.map(({ expiresAt }) => expiresAt));
    const timer = setTimeout(() => setAgents((current) => withoutExpired(current, Date.now())), nextExpiry - Date.now());
    return () => clearTimeout(timer);
  }, [agents]);

  return agents;
}

/** Fonction à appeler à chaque frappe d'un agent : le signal part au plus toutes les 2 s. */
export function useTypingSignal(ticketId: string): (isInternalNote: boolean) => void {
  const socketRef = useRef<RealtimeSocket | null>(null);
  const lastSignal = useRef<{ at: number; isInternalNote: boolean } | null>(null);

  useEffect(() => {
    const { socket, release } = acquireSocket();
    socketRef.current = socket;
    return () => {
      socketRef.current = null;
      release();
    };
  }, []);

  return useCallback(
    (isInternalNote: boolean) => {
      const now = Date.now();
      const socket = socketRef.current;
      if (!socket?.connected || !shouldSignalTyping(lastSignal.current, isInternalNote, now)) return;
      lastSignal.current = { at: now, isInternalNote };
      socket.emit("agent.typing", { ticketId, isInternalNote });
    },
    [ticketId],
  );
}

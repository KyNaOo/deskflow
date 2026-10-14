"use client";

import { useTypingAgents } from "@/lib/realtime/use-typing";
import { typingLabel } from "@/lib/realtime/typing";

/**
 * « Alice est en train d'écrire… ». Région live présente en permanence (et de hauteur fixe) :
 * les lecteurs d'écran annoncent le texte quand il apparaît, sans décaler la page.
 */
export function TypingIndicator({ ticketId, currentUserId }: { ticketId: string; currentUserId: string }) {
  const label = typingLabel(useTypingAgents(ticketId, currentUserId));

  return (
    <p aria-live="polite" className="h-5 text-sm text-muted-foreground italic">
      {label}
    </p>
  );
}

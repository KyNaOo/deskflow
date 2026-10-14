"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acquireSocket } from "@/lib/realtime/socket";

/**
 * Signale les tickets créés ou modifiés depuis l'affichage de la liste. On ne les réinsère pas
 * dans la liste : elle est filtrée et paginée par curseur côté serveur, donc c'est lui qui sait
 * où ils vont. Un clic relit simplement la page.
 */
export function TicketListUpdates() {
  const router = useRouter();
  const [hasUpdates, setHasUpdates] = useState(false);
  const [isRefreshing, startTransition] = useTransition();

  useEffect(() => {
    const { socket, release } = acquireSocket();
    // Agents et admins rejoignent la room de leur tenant à la connexion : rien d'autre à demander
    let connectedBefore = socket.connected;
    const onChange = () => setHasUpdates(true);
    // Après une coupure, des changements ont pu être manqués
    const onConnect = () => {
      if (connectedBefore) setHasUpdates(true);
      connectedBefore = true;
    };

    socket.on("ticket.created", onChange);
    socket.on("ticket.updated", onChange);
    socket.on("connect", onConnect);
    return () => {
      socket.off("ticket.created", onChange);
      socket.off("ticket.updated", onChange);
      socket.off("connect", onConnect);
      release();
    };
  }, []);

  function refresh() {
    setHasUpdates(false);
    startTransition(() => router.refresh());
  }

  // Région live présente dès le départ : les lecteurs d'écran annoncent le bandeau quand il apparaît
  return (
    <div role="status">
      {hasUpdates && (
        <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-2 text-sm">
          <span>Des tickets ont été créés ou modifiés.</span>
          <Button size="sm" variant="outline" onClick={refresh} disabled={isRefreshing}>
            Actualiser
          </Button>
        </div>
      )}
    </div>
  );
}

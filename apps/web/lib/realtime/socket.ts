import type { ClientToServerEvents, ServerToClientEvents } from "@deskflow/shared";
import { io, type Socket } from "socket.io-client";
import { refreshSession } from "@/lib/api/client";

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Délai avant de fermer le socket inutilisé : une navigation entre deux pages temps réel le garde ouvert. */
const DISCONNECT_DELAY_MS = 2000;

let socket: RealtimeSocket | null = null;
let users = 0;
let disconnectTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Un seul socket pour tout l'onglet, connecté à la demande : tant qu'au moins un composant
 * l'utilise. `release()` à appeler au démontage.
 */
export function acquireSocket(): { socket: RealtimeSocket; release: () => void } {
  const current = (socket ??= createSocket());
  users += 1;
  clearTimeout(disconnectTimer);
  if (!current.connected && !current.active) {
    current.connect();
  }

  let released = false;
  return {
    socket: current,
    release() {
      if (released) return;
      released = true;
      users -= 1;
      if (users === 0) {
        disconnectTimer = setTimeout(() => current.disconnect(), DISCONNECT_DELAY_MS);
      }
    },
  };
}

function createSocket(): RealtimeSocket {
  const created: RealtimeSocket = io(process.env.NEXT_PUBLIC_API_URL, {
    // Cookie httpOnly de session envoyé au handshake, comme pour les appels REST
    withCredentials: true,
    // Pas de long-polling : une connexion WebSocket reste sur l'instance de l'API qui l'a ouverte,
    // sans sticky sessions quand l'API tourne sur plusieurs instances
    transports: ["websocket"],
    autoConnect: false,
  });

  // Handshake refusé (access token expiré) : Socket.io ne réessaie pas seul. On renouvelle la
  // session une fois, comme apiFetch ; une coupure réseau, elle, est retentée automatiquement.
  let refreshTried = false;
  created.on("connect", () => {
    refreshTried = false;
  });
  created.on("connect_error", async () => {
    if (created.active || refreshTried) return;
    refreshTried = true;
    if ((await refreshSession()) && users > 0) {
      created.connect();
    }
  });
  return created;
}

import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { ClientToServerEvents, ServerToClientEvents } from '@deskflow/shared';
import { io, type Socket } from 'socket.io-client';

export type TestSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** URL de l'app démarrée par createTestApp (port aléatoire). */
export function appUrl(app: INestApplication): string {
  const { port } = app.getHttpServer().address() as AddressInfo;
  return `http://localhost:${port}`;
}

/**
 * Connecte un client Socket.io avec l'en-tête Cookie donné (comme le navigateur avec
 * withCredentials). Rejette avec l'erreur du serveur si le handshake est refusé.
 */
export function connectSocket(url: string, cookie?: string): Promise<TestSocket> {
  const socket: TestSocket = io(url, {
    transports: ['websocket'],
    extraHeaders: cookie ? { cookie } : {},
    reconnection: false,
    forceNew: true,
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

/**
 * Enregistre chaque événement reçu, dans l'ordre. Pour vérifier qu'un événement n'a PAS été reçu,
 * on attend un événement envoyé juste après : l'ordre d'émission est conservé pour un même socket.
 */
export function recordEvents(socket: TestSocket) {
  const received: { event: string; payload: any }[] = [];
  socket.onAny((event: string, payload: unknown) => received.push({ event, payload }));

  return {
    received,
    /** Attend le premier événement de ce nom qui satisfait le prédicat. */
    async waitFor(event: string, matches: (payload: any) => boolean = () => true, timeoutMs = 2000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const found = received.find((entry) => entry.event === event && matches(entry.payload));
        if (found) {
          return found.payload;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(`Événement ${event} non reçu après ${timeoutMs} ms`);
    },
  };
}

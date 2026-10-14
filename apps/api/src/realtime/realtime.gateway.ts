import { Inject, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  type ClientToServerEvents,
  type JoinTicketAck,
  ticketRoomRequestSchema,
} from '@deskflow/shared';
import { parseCookie } from 'cookie';
import { ClsService } from 'nestjs-cls';
import type { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants.js';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { TokenService } from '../auth/token.service.js';
import type { TenantStore } from '../common/tenant-store.js';
import { Role } from '../generated/prisma/client.js';
import { TENANT_PRISMA, type TenantPrisma } from '../prisma/tenant-prisma.js';
import { ticketAccessFilter } from '../tickets/ticket-access.js';
import { rooms } from './realtime-rooms.js';

interface SocketData {
  user: AuthenticatedUser;
}

// Les événements serveur ne sont pas typés ici : l'api émet les objets Prisma (dates en Date),
// sérialisés en JSON comme les réponses REST. Leur forme côté navigateur est dans @deskflow/shared.
export type RealtimeServer = Server<ClientToServerEvents, any, any, SocketData>;
type RealtimeSocket = Socket<ClientToServerEvents, any, any, SocketData>;

/**
 * Point d'entrée WebSocket : authentifie chaque connexion et gère les abonnements aux tickets.
 * Les événements métier sont émis par RealtimeService.
 */
@WebSocketGateway()
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: RealtimeServer;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly cls: ClsService<TenantStore>,
    @Inject(TENANT_PRISMA) private readonly prisma: TenantPrisma,
  ) {}

  afterInit(server: RealtimeServer) {
    // Au handshake : le navigateur envoie le cookie httpOnly de l'access token (withCredentials).
    // Sans jeton valide, la connexion est refusée avant d'exister (`connect_error` côté client).
    server.use((socket, next) => {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
      this.tokens.verifyAccessToken(cookies[ACCESS_TOKEN_COOKIE]).then((user) => {
        if (!user) {
          next(new Error('Non authentifié'));
          return;
        }
        socket.data.user = user;
        next();
      }, next);
    });
  }

  async handleConnection(socket: RealtimeSocket) {
    const { user } = socket.data;
    if (isAgent(user)) {
      await socket.join(rooms.tenantAgents(user.tenantId));
    }
  }

  /** Suivre un ticket : même règle d'accès que l'API REST (tenant, puis client propriétaire). */
  @SubscribeMessage('ticket.join')
  async joinTicket(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() body: unknown,
  ): Promise<JoinTicketAck> {
    const request = ticketRoomRequestSchema.safeParse(body);
    if (!request.success) {
      return { ok: false, error: 'Identifiant de ticket invalide' };
    }

    const { user } = socket.data;
    const { ticketId } = request.data;
    if (!(await this.canAccessTicket(user, ticketId))) {
      return { ok: false, error: 'Ticket introuvable' };
    }

    await socket.join(rooms.ticket(ticketId));
    if (isAgent(user)) {
      await socket.join(rooms.ticketAgents(ticketId));
    }
    return { ok: true };
  }

  @SubscribeMessage('ticket.leave')
  async leaveTicket(@ConnectedSocket() socket: RealtimeSocket, @MessageBody() body: unknown) {
    const request = ticketRoomRequestSchema.safeParse(body);
    if (request.success) {
      await socket.leave(rooms.ticket(request.data.ticketId));
      await socket.leave(rooms.ticketAgents(request.data.ticketId));
    }
  }

  /**
   * Hors requête HTTP, aucun contexte tenant n'est ouvert : on en ouvre un avec le tenant du
   * JWT, pour lire le ticket à travers le même client Prisma filtré que le reste de l'API.
   */
  private canAccessTicket(user: AuthenticatedUser, ticketId: string): Promise<boolean> {
    return this.cls.run(async () => {
      this.cls.set('tenantId', user.tenantId);
      try {
        const ticket = await this.prisma.ticket.findFirst({
          where: { id: ticketId, ...ticketAccessFilter(user) },
          select: { id: true },
        });
        return ticket !== null;
      } catch (error) {
        this.logger.error(error);
        return false;
      }
    });
  }
}

function isAgent(user: AuthenticatedUser): boolean {
  return user.role !== Role.CUSTOMER;
}

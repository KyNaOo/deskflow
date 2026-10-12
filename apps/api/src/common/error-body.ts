import { STATUS_CODES } from 'node:http';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

/** Format unique de toutes les erreurs de l'API (le requestId est ajouté par le filtre). */
export interface ErrorBody {
  statusCode: number;
  error: string;
  /** Une liste pour les erreurs de validation (un message par champ) */
  message: string | string[];
  details?: unknown;
}

// Filet de sécurité : un service peut toujours lever une erreur plus précise lui-même
const PRISMA_ERRORS: Record<string, { status: HttpStatus; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'Cette ressource existe déjà' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Ressource introuvable' },
};

/** Traduit n'importe quelle exception en réponse d'erreur, sans jamais exposer de détail interne. */
export function toErrorBody(exception: unknown): ErrorBody {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return errorBody(status, response);
    }
    if ('message' in response) {
      return errorBody(status, response.message as string | string[]);
    }
    // Réponse structurée sans message (ex. rapport de @nestjs/terminus) : conservée telle quelle
    return { ...errorBody(status, statusText(status)), details: response };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const known = PRISMA_ERRORS[exception.code];
    if (known) {
      return errorBody(known.status, known.message);
    }
  }

  return errorBody(HttpStatus.INTERNAL_SERVER_ERROR, 'Erreur interne du serveur');
}

function errorBody(status: number, message: string | string[]): ErrorBody {
  return { statusCode: status, error: statusText(status), message };
}

function statusText(status: number): string {
  return STATUS_CODES[status] ?? 'Error';
}

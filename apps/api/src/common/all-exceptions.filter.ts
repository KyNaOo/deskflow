import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toErrorBody } from './error-body.js';

/**
 * Filtre global : toutes les erreurs sortent au même format, avec l'identifiant de la requête
 * (le même que dans les logs et l'en-tête X-Request-Id) pour retrouver la trace d'un incident.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const body = toErrorBody(exception);

    // Les HttpException sont des refus voulus ; le reste est un bug, à journaliser avec sa stack
    if (body.statusCode >= 500 && !(exception instanceof HttpException)) {
      this.logger.error(exception);
    }

    http.getResponse<Response>().status(body.statusCode).json({ ...body, requestId: request.id });
  }
}

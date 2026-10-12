import {
  BadRequestException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { toErrorBody } from './error-body.js';

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('erreur Prisma', { code, clientVersion: 'test' });
}

describe('toErrorBody', () => {
  it('garde le statut et le message d’une HttpException', () => {
    expect(toErrorBody(new NotFoundException('Ticket introuvable'))).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Ticket introuvable',
    });
  });

  it('utilise le message par défaut d’une HttpException sans message', () => {
    expect(toErrorBody(new UnauthorizedException())).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Unauthorized',
    });
  });

  it('garde la liste des messages d’une erreur de validation', () => {
    const exception = new BadRequestException(['email must be an email', 'slug is too short']);

    expect(toErrorBody(exception).message).toEqual(['email must be an email', 'slug is too short']);
  });

  it('accepte une HttpException construite avec une simple chaîne', () => {
    expect(toErrorBody(new HttpException('Trop de tentatives', HttpStatus.TOO_MANY_REQUESTS))).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Trop de tentatives',
    });
  });

  it('conserve une réponse structurée sans message dans details', () => {
    const report = { status: 'error', error: { database: { status: 'down' } } };

    expect(toErrorBody(new ServiceUnavailableException(report))).toEqual({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Service Unavailable',
      details: report,
    });
  });

  it('traduit une violation de contrainte unique Prisma (P2002) en 409', () => {
    expect(toErrorBody(prismaError('P2002'))).toMatchObject({ statusCode: 409, error: 'Conflict' });
  });

  it('traduit un enregistrement introuvable Prisma (P2025) en 404', () => {
    expect(toErrorBody(prismaError('P2025'))).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });

  it.each([new Error('mot de passe de la base : hunter2'), prismaError('P1001'), 'chaîne levée'])(
    'répond 500 sans aucun détail interne pour %s',
    (exception) => {
      expect(toErrorBody(exception)).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Erreur interne du serveur',
      });
    },
  );
});

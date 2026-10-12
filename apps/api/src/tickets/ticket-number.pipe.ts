import { BadRequestException, PipeTransform } from '@nestjs/common';

// Plus grand entier de la colonne `number` (INTEGER PostgreSQL)
const MAX_TICKET_NUMBER = 2_147_483_647;

/** Numéro de ticket dans l'URL : entier strictement positif (`/tickets/42`). */
export class TicketNumberPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const number = /^[1-9]\d*$/.test(value) ? Number(value) : NaN;
    if (!(number <= MAX_TICKET_NUMBER)) {
      throw new BadRequestException('Numéro de ticket invalide');
    }
    return number;
  }
}

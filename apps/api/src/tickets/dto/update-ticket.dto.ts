import { updateTicketSchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class UpdateTicketDto extends createZodDto(updateTicketSchema) {}

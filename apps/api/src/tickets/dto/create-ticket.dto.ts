import { createTicketSchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class CreateTicketDto extends createZodDto(createTicketSchema) {}

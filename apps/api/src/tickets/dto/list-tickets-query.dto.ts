import { listTicketsQuerySchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class ListTicketsQueryDto extends createZodDto(listTicketsQuerySchema) {}

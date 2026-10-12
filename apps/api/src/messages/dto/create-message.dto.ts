import { createMessageSchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class CreateMessageDto extends createZodDto(createMessageSchema) {}

import { createAttachmentSchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class CreateAttachmentDto extends createZodDto(createAttachmentSchema) {}

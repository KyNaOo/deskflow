import { acceptInvitationSchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class AcceptInvitationDto extends createZodDto(acceptInvitationSchema) {}

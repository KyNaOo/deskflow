import { inviteUserSchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class InviteUserDto extends createZodDto(inviteUserSchema) {}

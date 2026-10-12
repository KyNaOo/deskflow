import { loginSchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class LoginDto extends createZodDto(loginSchema) {}

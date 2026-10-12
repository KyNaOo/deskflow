import { registerTenantSchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class RegisterTenantDto extends createZodDto(registerTenantSchema) {}

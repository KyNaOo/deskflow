import { registerCustomerSchema } from '@deskflow/shared';
import { createZodDto } from '../../common/zod-validation.js';

export class RegisterCustomerDto extends createZodDto(registerCustomerSchema) {}

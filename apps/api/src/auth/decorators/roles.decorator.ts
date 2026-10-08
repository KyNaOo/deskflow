import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../generated/prisma/client.js';

export const ROLES_KEY = 'roles';

/** Restreint une route aux rôles indiqués : `@Roles(Role.ADMIN)`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

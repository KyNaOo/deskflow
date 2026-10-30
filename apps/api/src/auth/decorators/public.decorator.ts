import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export const IS_PUBLIC_KEY = 'isPublic';

/** Ouvre une route sans authentification. Toutes les autres routes sont protégées par défaut. */
export const Public = () =>
  applyDecorators(
    SetMetadata(IS_PUBLIC_KEY, true),
    // OpenAPI : une exigence de sécurité vide signifie « accessible sans s'authentifier »
    ApiSecurity({}),
  );

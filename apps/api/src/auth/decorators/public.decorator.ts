import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Ouvre une route sans authentification. Toutes les autres routes sont protégées par défaut. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

import { z } from 'zod';

// Messages par défaut de zod en français (« Clé non reconnue », …), identiques côté api et front.
// Effet de bord voulu : tout code qui importe ce package valide avec les mêmes messages.
z.config(z.locales.fr());

export * from './auth.js';
export * from './fields.js';
export * from './roles.js';
export * from './tickets.js';

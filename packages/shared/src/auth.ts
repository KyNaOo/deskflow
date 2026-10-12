import { z } from 'zod';
import { email, newPassword, requiredText } from './fields.js';
import { INVITABLE_ROLES } from './roles.js';

/** Premiers segments d'URL déjà utilisés par le front : un tenant ne peut pas les prendre. */
export const RESERVED_SLUGS = ['login', 'register', 'invitations', 'refresh', 'portal', 'api'];

/** Identifiant de l'organisation dans les URLs : `acme-corp` */
export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, '3 caractères minimum')
  .max(50, '50 caractères maximum')
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lettres minuscules, chiffres et tirets uniquement')
  .refine((value) => !RESERVED_SLUGS.includes(value), 'Cet identifiant est réservé');

// Objets stricts : un champ inconnu est refusé (400) plutôt qu'ignoré

export const registerTenantSchema = z.strictObject({
  organizationName: requiredText(100),
  slug,
  name: requiredText(100),
  email,
  password: newPassword,
});

export const loginSchema = z.strictObject({
  tenantSlug: z.string().trim().toLowerCase().min(1, 'Champ obligatoire'),
  email,
  // Pas de règle de longueur minimale à la connexion : seul le mot de passe enregistré compte
  password: z.string().min(1, 'Champ obligatoire').max(128, '128 caractères maximum'),
});

export const acceptInvitationSchema = z.strictObject({
  /** Jeton reçu dans le lien de l'e-mail d'invitation */
  token: z.string().min(1, 'Champ obligatoire').max(100),
  name: requiredText(100),
  password: newPassword,
});

export const inviteUserSchema = z.strictObject({
  email,
  role: z.enum(INVITABLE_ROLES, 'Rôle invalide : AGENT ou ADMIN'),
});

export type RegisterTenantInput = z.infer<typeof registerTenantSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

import { z } from "zod";

// Mêmes règles que les DTO de l'API : l'erreur s'affiche avant même l'envoi.
// Ces schémas rejoindront packages/shared au Jalon 2.

const email = z.email("Adresse e-mail invalide").trim().toLowerCase();
const password = z
  .string()
  .min(8, "8 caractères minimum")
  .max(128, "128 caractères maximum");
const name = z.string().trim().min(1, "Champ obligatoire").max(100, "100 caractères maximum");

export const loginSchema = z.object({
  tenantSlug: z.string().trim().toLowerCase().min(1, "Champ obligatoire"),
  email,
  password: z.string().min(1, "Champ obligatoire"),
});

export const registerSchema = z.object({
  organizationName: name,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "3 caractères minimum")
    .max(50, "50 caractères maximum")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lettres minuscules, chiffres et tirets uniquement"),
  name,
  email,
  password,
});

export const acceptInvitationSchema = z.object({ name, password });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type AcceptInvitationValues = z.infer<typeof acceptInvitationSchema>;

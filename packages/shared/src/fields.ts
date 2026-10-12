import { z } from 'zod';

// Briques communes aux schémas. trim() et toLowerCase() s'appliquent avant la validation :
// z.email().trim() validerait le format avant de retirer les espaces.

/** Identifiants insensibles à la casse (e-mail, slug) : « Alice@Acme.test » = « alice@acme.test » */
export const email = z.string().trim().toLowerCase().pipe(z.email('Adresse e-mail invalide'));

export const requiredText = (max: number) =>
  z.string().trim().min(1, 'Champ obligatoire').max(max, `${max} caractères maximum`);

// Borne haute : évite de faire hasher par argon2 des chaînes énormes (déni de service)
export const newPassword = z
  .string()
  .min(8, '8 caractères minimum')
  .max(128, '128 caractères maximum');

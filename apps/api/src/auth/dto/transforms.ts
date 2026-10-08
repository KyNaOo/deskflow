// Fonctions pour @Transform (class-transformer), appliquées avant la validation

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Pour les identifiants insensibles à la casse : e-mail, slug */
export const trimAndLowercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

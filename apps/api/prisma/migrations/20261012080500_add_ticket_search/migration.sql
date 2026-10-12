-- Recherche plein texte sur les tickets, écrite à la main : Prisma ne sait pas générer
-- de configuration de recherche ni de colonne calculée (GENERATED ALWAYS AS).

-- Configuration « français sans accents » : racinisation française (« impressions » trouve
-- « impression ») et accents ignorés (« reseau » trouve « réseau »)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TEXT SEARCH CONFIGURATION french_unaccent (COPY = french);
ALTER TEXT SEARCH CONFIGURATION french_unaccent
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem;

-- Colonne calculée par PostgreSQL à chaque écriture : jamais désynchronisée du sujet
ALTER TABLE "tickets" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('french_unaccent', "subject")) STORED;

-- Index inversé : retrouve les tickets contenant un mot sans parcourir toute la table
CREATE INDEX "tickets_search_vector_idx" ON "tickets" USING GIN ("search_vector");

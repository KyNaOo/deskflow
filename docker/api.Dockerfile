# Image de production de l'api. La même image lance l'API (`node dist/main.js`, par défaut)
# et le worker (`node dist/worker.js`). La cible `migrate` applique les migrations.
#   docker build -f docker/api.Dockerfile -t deskflow-api .
#   docker build -f docker/api.Dockerfile --target migrate -t deskflow-migrate .

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm \
    pnpm_config_store_dir=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
# Même version que le champ packageManager du package.json racine
ARG PNPM_VERSION=12.8.1
RUN npm install -g pnpm@${PNPM_VERSION}

# --- Build : toutes les dépendances, compilation, puis extraction des seules dépendances de prod
FROM base AS build
WORKDIR /repo
# Le lockfile seul suffit à télécharger les paquets : cette couche reste en cache
# tant que les dépendances ne changent pas, même si le code change
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .
# postinstall : client Prisma (api) et dist/ de packages/shared
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "api..."
RUN pnpm --filter api build
# Dossier autonome : package.json + node_modules de production, @deskflow/shared compris.
# --ignore-scripts : le postinstall (prisma generate) a besoin du CLI, absent en prod ;
# le client généré est déjà compilé dans dist/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter api deploy --prod --ignore-scripts /prod
# Même chose avec les dépendances de dev (CLI Prisma, tsx), pour l'image `migrate`.
# Scripts conservés : moteur de migration de Prisma et client généré (utilisé par le seed).
# Celui de @deskflow/shared (recompilation) est ignoré, son dist/ est déjà copié : sans
# strict-dep-builds=false, pnpm en ferait une erreur
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter api deploy --config.strict-dep-builds=false /migrate

# --- Migrations : lancées une fois par déploiement, pas au démarrage de chaque instance.
# Sert aussi au seed (`prisma db seed`) et à la préparation du bucket (`tsx scripts/setup-storage.ts`).
FROM node:24-alpine AS migrate
ENV PATH=/app/node_modules/.bin:$PATH
WORKDIR /app
COPY --from=build /migrate ./
USER node
CMD ["prisma", "migrate", "deploy"]

# --- Image finale : code compilé et dépendances de production, sans pnpm ni outils de build
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Fichiers laissés à root, en lecture seule pour l'utilisateur qui exécute l'application
COPY --from=build /prod/package.json ./
COPY --from=build /prod/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]

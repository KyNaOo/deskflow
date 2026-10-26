# Image de production du front (sortie `standalone` de Next.js).
# L'adresse publique de l'API est intégrée au bundle du navigateur : elle se fixe au build.
#   docker build -f docker/web.Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.exemple.fr -t deskflow-web .

FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm \
    pnpm_config_store_dir=/pnpm/store \
    NEXT_TELEMETRY_DISABLED=1
ENV PATH=$PNPM_HOME:$PATH
# Même version que le champ packageManager du package.json racine
ARG PNPM_VERSION=12.8.1
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo
# Le lockfile seul suffit à télécharger les paquets : cette couche reste en cache
# tant que les dépendances ne changent pas, même si le code change
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch
COPY . .
# postinstall : dist/ de packages/shared
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter "web..."
ARG NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL" || (echo "NEXT_PUBLIC_API_URL est requis" && exit 1)
RUN pnpm --filter web build

# --- Image finale : le serveur autonome de Next.js, sans pnpm ni node_modules complets
FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
# Fichiers laissés à root, en lecture seule pour l'utilisateur qui exécute l'application.
# Le serveur standalone ne copie ni les fichiers statiques ni public/ : on les ajoute.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

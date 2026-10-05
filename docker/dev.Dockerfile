# Image de développement : Node + pnpm, utilisée par tous les services applicatifs
# et par la commande `bin/pnpm`. Aucun outil JS n'est installé sur l'hôte.
FROM node:24-bookworm-slim

# openssl : requis par Prisma ; git : requis par certains CLIs (nest, husky)
# procps (ps) : requis par `nest start --watch` pour tuer l'ancien process au reload
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl git ca-certificates procps \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm \
    NEXT_TELEMETRY_DISABLED=1 \
    TURBO_TELEMETRY_DISABLED=1
ENV PATH=$PNPM_HOME:$PATH

# pnpm installé dans l'image, à la même version que le champ packageManager
# du package.json racine (sinon pnpm retélécharge la bonne version à chaque run)
ARG PNPM_VERSION=12.8.1
RUN npm install -g pnpm@${PNPM_VERSION} \
  && mkdir -p /pnpm/store && chown -R node:node /pnpm

# L'utilisateur `node` a l'UID 1000 : les fichiers créés dans le bind mount
# appartiennent à l'utilisateur de l'hôte.
USER node
WORKDIR /app

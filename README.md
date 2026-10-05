# Deskflow

Help desk SaaS multi-tenant avec assistant IA : tickets, chat temps réel entre clients et agents, suggestions de réponse basées sur la base de connaissances de chaque organisation (RAG).

> 🚧 Projet en cours de construction — Jalon 0 (socle).

**Stack :** TypeScript · NestJS · Next.js · PostgreSQL + pgvector · Redis · BullMQ · Socket.io · Docker · Turborepo

---

## Prérequis

**Uniquement Docker** (avec Docker Compose v2). Node, pnpm et tous les outils du projet tournent dans des conteneurs : rien d'autre à installer sur la machine.

## Démarrage rapide

```bash
# 1. Variables d'environnement
cp .env.example .env

# 2. Installer les dépendances (dans un conteneur)
bin/pnpm install

# 3. Lancer toute la stack
docker compose up
```

C'est tout. Le code est monté dans les conteneurs : toute modification recharge automatiquement l'api et le front.

## Services

| Service | URL | Rôle |
|---|---|---|
| `web` | http://localhost:3000 | Front Next.js |
| `api` | http://localhost:3001 | API NestJS |
| `postgres` | `localhost:5432` | PostgreSQL 18 + pgvector (user / mdp / base : `deskflow`) |
| `redis` | `localhost:6379` | Cache, pub/sub, files BullMQ |
| `s3` | http://localhost:8333 | Stockage objet compatible S3 (SeaweedFS) — admin : http://localhost:23646 |
| `mailpit` | http://localhost:8025 | Boîte mail de dev : capture tous les e-mails envoyés |

Un port est déjà pris sur votre machine ? Changez-le dans `.env` (`WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, `MAILPIT_UI_PORT`…).

## Commandes utiles

Deux scripts dans `bin/` remplacent les outils locaux :

| Commande | Effet |
|---|---|
| `bin/pnpm <args>` | Lance `pnpm` dans le conteneur `tools` |
| `bin/sh [cmd]` | Ouvre un shell dans le conteneur (ou exécute `cmd`) |

```bash
# Dépendances
bin/pnpm install
bin/pnpm --filter api add zod              # ajouter une dépendance à l'api
bin/pnpm --filter web add -D @types/foo    # dépendance de dev au front
bin/pnpm add -w -D <pkg>                   # dépendance à la racine du monorepo

# Qualité (via Turborepo, sur tout le monorepo)
bin/pnpm lint
bin/pnpm typecheck
bin/pnpm test
bin/pnpm build

# Cibler une seule app
bin/pnpm --filter api test:watch
bin/pnpm --filter api test:e2e

# Stack Docker
docker compose up -d                 # en arrière-plan
docker compose logs -f api           # suivre les logs d'un service
docker compose restart api
docker compose down                  # arrêter
docker compose down -v               # arrêter ET supprimer les données (BDD, Redis, S3)
docker compose build tools           # reconstruire l'image de dev (après modif du Dockerfile)
```

> Astuce : les `node_modules` sont écrits dans le dossier du projet avec votre UID, donc VS Code (autocomplétion, typecheck) fonctionne normalement.

## Structure du dépôt

```
deskflow/
├── apps/
│   ├── api/              # NestJS (Vitest, oxlint)
│   └── web/              # Next.js App Router + Tailwind
├── packages/
│   └── tsconfig/         # configs TypeScript partagées (strict)
├── docker/
│   └── dev.Dockerfile    # image de dev : Node 24 + pnpm
├── bin/                  # wrappers Docker (pnpm, sh)
├── docker-compose.yml
└── turbo.json
```

## Choix techniques

- **Tout dockerisé** : un nouveau développeur (ou la CI) n'a besoin que de Docker ; les versions de Node et pnpm sont figées dans l'image.
- **pnpm workspaces + Turborepo** : types partagés entre front et back, tâches mises en cache.
- **PostgreSQL + pgvector** plutôt qu'une base vectorielle dédiée : relationnel et embeddings dans la même base, les mêmes transactions et la même isolation par tenant.
- **SeaweedFS** en local pour le stockage objet : API S3, donc le même code fonctionne avec S3 / R2 en production (MinIO ne publie plus d'images Docker).

## Dépannage

- **`port is already allocated`** : un autre projet utilise ce port → modifier la variable correspondante dans `.env`.
- **Dépendances incohérentes après un `git pull`** : `bin/pnpm install`.
- **Repartir de zéro** : `docker compose down -v && rm -rf node_modules apps/*/node_modules && bin/pnpm install`.

## Feuille de route

- [x] Jalon 0 — Socle : monorepo, Docker Compose, apps api / web
- [ ] Jalon 0 — Prisma, config validée, `/health`, CI, hooks git
- [ ] Jalon 1 — Authentification et multi-tenant
- [ ] Jalon 2 — Tickets et messages
- [ ] Jalon 3 — Temps réel et pièces jointes
- [ ] Jalon 4 — Traitements asynchrones
- [ ] Jalon 5 — Assistant IA (RAG)
- [ ] Jalon 6 — Analytics, finition, déploiement

# Deskflow

[![CI](https://github.com/KyNaOo/deskflow/actions/workflows/ci.yml/badge.svg)](https://github.com/KyNaOo/deskflow/actions/workflows/ci.yml)

Help desk SaaS multi-tenant avec assistant IA : tickets, chat temps réel entre clients et agents, suggestions de réponse basées sur la base de connaissances de chaque organisation (RAG).

> 🚧 Projet en cours de construction — Jalon 0 (socle) terminé, Jalon 1 (authentification et multi-tenant) en cours.

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

# 3. Créer les tables et les données de démo
bin/pnpm db:deploy
bin/pnpm db:seed

# 4. Lancer toute la stack
docker compose up
```

> ⚠️ Si `docker compose up` échoue avec `port is already allocated`, un autre projet occupe ce port : changez la variable correspondante dans `.env` (voir [Dépannage](#dépannage)). Tant qu'un service ne démarre pas, Compose interrompt le lancement et **les autres services (dont `web`) ne démarrent pas non plus**.

C'est tout. Le code est monté dans les conteneurs : toute modification recharge automatiquement l'api et le front.

### Comptes de démonstration

Créés par `bin/pnpm db:seed` dans l'organisation **Acme Corp** (`acme`), mot de passe `password` :

| Rôle | E-mail |
|---|---|
| Admin | `admin@acme.test` |
| Agent | `agent@acme.test` |
| Client | `client@acme.test` |

## Services

| Service | URL | Rôle |
|---|---|---|
| `web` | http://localhost:3000 | Front Next.js |
| `api` | http://localhost:3001 | API NestJS — état de santé : http://localhost:3001/health |
| `postgres` | `localhost:5432` | PostgreSQL 18 + pgvector (user / mdp / base : `deskflow`) |
| `redis` | `localhost:6379` | Cache, pub/sub, files BullMQ |
| `s3` | http://localhost:8333 | API S3 (SeaweedFS) — un `AccessDenied` dans le navigateur est **normal** : l'API exige des requêtes signées |
| `s3` (admin) | http://localhost:23646 | Interface web de SeaweedFS (buckets, fichiers) |
| `mailpit` | http://localhost:8026 | Boîte mail de dev : capture tous les e-mails envoyés |

Un port est déjà pris sur votre machine ? Changez-le dans `.env` (`WEB_PORT`, `API_PORT`, `POSTGRES_PORT`, `MAILPIT_UI_PORT`…).

## Configuration

Les variables d'environnement sont définies dans `.env` (modèle : `.env.example`) et injectées dans les conteneurs par Docker Compose.

Côté API, elles sont **validées au démarrage** par un schéma zod (`apps/api/src/config/env.ts`) : si une variable manque ou est invalide, l'API refuse de démarrer avec un message explicite. Dans le code, elles se lisent de façon typée :

```ts
constructor(config: ConfigService<Env, true>) {
  const url = config.get('DATABASE_URL', { infer: true }); // string, jamais undefined
}
```

Nouvelle variable → l'ajouter à `.env.example` **et** au schéma `envSchema`.

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

# Base de données (Prisma)
bin/pnpm db:migrate --name add_tickets   # après modif du schéma : crée + applique une migration
bin/pnpm db:deploy                       # applique les migrations existantes (CI, prod, après un pull)
bin/pnpm db:seed                         # (ré)insère les données de démo — idempotent
bin/pnpm db:reset                        # ⚠️ vide la base, rejoue les migrations et le seed
bin/pnpm db:generate                     # régénère le client typé (automatique après install)
docker compose exec postgres psql -U deskflow   # console SQL

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
│   │   ├── prisma/       # schema.prisma, migrations SQL, seed
│   │   └── src/
│   │       ├── auth/     # inscription, connexion, JWT + refresh tokens, guards
│   │       ├── prisma/   # PrismaService (non filtré) + client filtré par tenant
│   │       └── users/    # première route métier, démontre l'isolation tenant
│   └── web/              # Next.js App Router + Tailwind
├── packages/
│   └── tsconfig/         # configs TypeScript partagées (strict)
├── docker/
│   └── dev.Dockerfile    # image de dev : Node 24 + pnpm
├── .github/workflows/    # CI GitHub Actions
├── bin/                  # wrappers Docker (pnpm, sh)
├── docker-compose.yml
└── turbo.json
```

## Choix techniques

- **Tout dockerisé** : un nouveau développeur (ou la CI) n'a besoin que de Docker ; les versions de Node et pnpm sont figées dans l'image.
- **pnpm workspaces + Turborepo** : types partagés entre front et back, tâches mises en cache.
- **PostgreSQL + pgvector** plutôt qu'une base vectorielle dédiée : relationnel et embeddings dans la même base, les mêmes transactions et la même isolation par tenant.
- **Prisma** : schéma unique, migrations SQL versionnées et client entièrement typé. Tables et colonnes en `snake_case` (`@map`) pour garder un SQL brut lisible là où Prisma ne suffit pas (recherche vectorielle, plein texte, analytics).
- **Isolation multi-tenant automatique** : le `tenantId` vient toujours du JWT, jamais de la requête. `JwtAuthGuard` le dépose dans un contexte par requête (`nestjs-cls`, basé sur `AsyncLocalStorage`) et une extension Prisma l'ajoute à chaque requête sur les modèles concernés. Le code métier n'écrit jamais `where: { tenantId }` : il ne peut donc pas l'oublier. Une ressource d'un autre tenant renvoie **404** (et non 403, pour ne pas confirmer qu'elle existe), et une requête faite hors contexte tenant échoue au lieu de tout lire.
- **SeaweedFS** en local pour le stockage objet : API S3, donc le même code fonctionne avec S3 / R2 en production (MinIO ne publie plus d'images Docker).

## Dépannage

- **`port is already allocated`** : un autre projet utilise ce port → modifier la variable correspondante dans `.env` (ex. `MAILPIT_UI_PORT=8027`), puis `docker compose up -d`. Pour trouver le coupable : `docker ps --format '{{.Names}}\t{{.Ports}}' | grep 8026`.
- **`api` reste en `unhealthy`** : `curl localhost:3001/health` indique quelle dépendance est `down` (en général la base : `docker compose ps postgres`).
- **`web` inaccessible alors que l'api répond** : un service n'a pas pu démarrer et Compose a interrompu le lancement → `docker compose ps -a` pour voir lequel est resté en `Created`.
- **`Configuration invalide` au démarrage de l'api** : une variable a été ajoutée au projet → comparer son `.env` avec `.env.example`, puis `docker compose up -d` (recrée les conteneurs avec la nouvelle config).
- **Dépendances incohérentes après un `git pull`** : `bin/pnpm install`, puis `bin/pnpm db:deploy` si de nouvelles migrations sont arrivées.
- **`Cannot find module '.../src/generated/prisma/...'`** : le client Prisma n'est pas généré (il n'est pas versionné) → `bin/pnpm db:generate`.
- **Repartir de zéro** : `docker compose down -v && rm -rf node_modules apps/*/node_modules && bin/pnpm install`.

## Feuille de route

- [x] Jalon 0 — Socle : monorepo, Docker Compose, apps api / web
- [x] Jalon 0 — Prisma : schéma Tenant / User, première migration (+ pgvector), seed
- [x] Jalon 0 — Config typée et validée au démarrage (`@nestjs/config` + zod)
- [x] Jalon 0 — Endpoint `/health` (`@nestjs/terminus`) + healthcheck Docker
- [x] Jalon 0 — CI GitHub Actions : lint → typecheck → tests → build → tests e2e sur un vrai Postgres
- [ ] Jalon 1 — Authentification et multi-tenant
- [ ] Jalon 2 — Tickets et messages
- [ ] Jalon 3 — Temps réel et pièces jointes
- [ ] Jalon 4 — Traitements asynchrones
- [ ] Jalon 5 — Assistant IA (RAG)
- [ ] Jalon 6 — Analytics, finition, déploiement

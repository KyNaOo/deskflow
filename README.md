# Deskflow

[![CI](https://github.com/KyNaOo/deskflow/actions/workflows/ci.yml/badge.svg)](https://github.com/KyNaOo/deskflow/actions/workflows/ci.yml)

Help desk SaaS multi-tenant avec assistant IA : tickets, chat temps réel entre clients et agents, suggestions de réponse basées sur la base de connaissances de chaque organisation (RAG).

> 🚧 Projet en cours de construction — Jalons 0 (socle), 1 (authentification et multi-tenant) et 2 (tickets et messages) terminés, prochaine étape : temps réel et pièces jointes.

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

- **Espace agents** : http://localhost:3000/login (organisation `acme`, compte admin ou agent)
- **Portail client** : http://localhost:3000/portal/acme (compte client, ou créez-en un)

Le seed crée aussi 50 tickets de démonstration (statuts, priorités et assignations variés) ouverts par le client, avec des réponses d'agent et une note interne sur le ticket n° 3 : de quoi essayer filtres, recherche, pagination et conversations.

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
| `shared` | — | Recompile `packages/shared` à chaque modification (l'api et le front se rechargent) |

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
bin/pnpm --filter web test

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
│   │       ├── auth/     # inscription, connexion, JWT + refresh tokens, guards, acceptation d'invitation
│   │       ├── mail/     # envoi d'e-mails (Nodemailer → Mailpit en dev)
│   │       ├── messages/ # conversation d'un ticket, notes internes, statut automatique
│   │       ├── common/   # filtre d'erreurs, logs, validation zod, contexte tenant
│   │       ├── prisma/   # PrismaService (non filtré) + client filtré par tenant
│   │       ├── realtime/ # gateway Socket.io : authentification au handshake, rooms, événements
│   │       ├── tickets/  # tickets : création (numérotation par tenant), liste (filtres, recherche, curseur), statut / priorité / assignation
│   │       └── users/    # liste des membres (isolation tenant), invitations
│   └── web/              # Next.js App Router + Tailwind + shadcn/ui (Vitest, ESLint)
│       ├── app/(auth)/   # connexion, inscription, acceptation d'invitation
│       ├── app/portal/[tenant]/ # portail client : inscription, mes demandes, conversation
│       ├── app/[tenant]/ # espace agents : liste (filtres dans l'URL), détail, nouveau ticket
│       ├── lib/api/      # clients API navigateur (refresh transparent) et serveur
│       └── proxy.ts      # redirection optimiste des pages privées sans session
├── packages/
│   ├── shared/           # schémas zod, types et machine à états des tickets, partagés api ↔ front
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
- **Invitations à usage unique** : un admin invite un agent par e-mail (`POST /users/invite`). Comme le refresh token, le jeton est aléatoire et seule son empreinte SHA-256 est stockée. Il expire au bout de 48 h et son acceptation (`POST /auth/accept-invitation`) est conditionnelle, donc deux requêtes simultanées ne peuvent pas créer deux comptes. En dev, les e-mails arrivent dans Mailpit.
- **Session côté front** : les jetons restent dans des cookies `httpOnly`, que le JavaScript ne lit jamais. Le navigateur appelle l'API directement (CORS limité à `WEB_URL`, avec `credentials`). Les Server Components appellent l'API par le réseau Docker en transmettant les cookies de la requête. Sur un 401, le client renouvelle la session puis rejoue la requête une seule fois. Les requêtes qui reçoivent un 401 en même temps attendent **le même** refresh : deux refresh simultanés présenteraient le même jeton, ce que l'API traite comme un vol. Quand le cookie d'accès a expiré au moment de charger une page, `proxy.ts` redirige vers `/refresh`, qui renouvelle la session dans le navigateur (le refresh token n'est envoyé qu'aux routes `/auth` de l'API) puis renvoie vers la page demandée.
- **Numéro de ticket séquentiel par tenant** (`#42`) : chaque organisation a sa propre séquence. Le numéro vient d'un compteur sur le tenant, incrémenté atomiquement (`UPDATE … SET ticket_counter = ticket_counter + 1 RETURNING`) dans la transaction qui crée le ticket. La ligne du tenant reste verrouillée jusqu'au commit, donc deux créations simultanées ne peuvent pas obtenir le même numéro ; un `MAX(number) + 1` le permettrait, ce que le test de 20 créations simultanées détecte. Les routes désignent un ticket par ce numéro (`GET /tickets/42`) : il est unique dans le tenant, et le tenant vient du JWT.
- **Liste des tickets : pagination par curseur** plutôt que par `OFFSET`. Le curseur (opaque, en base64url) contient la position du dernier ticket vu (`updatedAt`, `id`) : la page suivante reprend juste après, sans que PostgreSQL relise les pages précédentes, et un ticket créé entre deux pages ne décale pas la liste. L'`id` départage les tickets de même date. Un index `(tenant_id, updated_at DESC, id DESC)` sert cet ordre directement (vérifié avec `EXPLAIN` sur 20 000 tickets).
- **Recherche plein texte** PostgreSQL plutôt qu'un moteur dédié. Une colonne `tsvector` est **générée** par la base à partir du sujet, donc jamais désynchronisée, et indexée en GIN. Elle utilise une configuration « français sans accents » : racinisation française (« impressions » trouve « impression ») et accents ignorés (« reseau » trouve « réseau »). Prisma ne sachant pas filtrer ce type, la recherche est la seule requête en SQL brut : paramétrée (aucune concaténation de la saisie), avec un filtre tenant écrit explicitement et couvert par un test d'isolation.
- **Machine à états des statuts** : les transitions autorisées (`OPEN → PENDING → RESOLVED → CLOSED`, réouverture possible, `CLOSED` définitif) sont définies dans une seule table, dans `packages/shared`. L'API la fait respecter (409 sinon), et le front s'en servira pour ne proposer que les transitions possibles. Elle est testée sur toutes les paires de statuts. Le changement de statut est **conditionnel au statut lu** (`UPDATE … WHERE status = <lu>`) : si deux agents agissent en même temps, un seul l'emporte et l'autre reçoit 409, au lieu d'une transition validée sur une valeur périmée.
- **Messages et notes internes** : une note interne n'est jamais lue par un client, parce que le filtre est **dans la requête** (`isInternalNote = false`), pas appliqué après coup par le front. Les messages n'ont pas de `tenantId` : on y accède toujours à travers leur ticket, déjà filtré par tenant et par participant. Un message fait évoluer le ticket : la réponse d'un agent le passe en attente du client (`PENDING`) et pose `firstResponseAt` (indicateur du Jalon 6), celle du client le rouvre (`OPEN`). Ces transitions sont des mises à jour conditionnelles (`WHERE status IN (…)`), donc elles n'échouent jamais en cas d'action simultanée, et respectent la machine à états (vérifié par un test).
- **Validation partagée** : les règles de validation (longueurs, formats, slugs réservés…) sont des schémas zod de `packages/shared`, écrits **une seule fois**. Le front les utilise dans ses formulaires (react-hook-form) et l'API pour valider les requêtes : une petite `ZodValidationPipe` globale et des DTO créés par `createZodDto(schema)`, ce qui laisse les contrôleurs écrire `@Body() dto: LoginDto`. Une erreur affichée sous un champ est donc exactement celle que l'API renverrait.
- **Erreurs et logs** : toutes les erreurs sortent au même format (`{ statusCode, error, message, requestId }`), grâce à un filtre global. Une erreur inattendue renvoie un 500 générique : le détail ne quitte jamais le serveur. Les logs sont structurés en JSON avec `nestjs-pino`, une ligne par requête, avec le même `requestId` que la réponse et l'en-tête `X-Request-Id`. Les cookies et en-têtes d'authentification sont masqués. En dev, `pino-pretty` les rend lisibles : `docker compose logs -f api`.
- **Liste des tickets côté front** : Server Component. Les tickets arrivent avec le HTML, sans écran de chargement ni appel API depuis le navigateur. Les **filtres vivent dans l'URL** (`/acme/tickets?status=OPEN&q=panne`) : une vue filtrée se partage, se met en favori et survit au rechargement. Le seul composant client est le formulaire de filtres, qui ne charge rien lui-même : il réécrit l'URL (`router.replace`, recherche avec *debounce*), et le Server Component relit la liste. L'URL est lue avec les mêmes schémas zod que l'API ; une valeur invalide est ignorée plutôt que de casser la page.
- **Détail d'un ticket** : la page est lue côté serveur (ticket, conversation, agents). Les actions (réponse ou note interne, statut, priorité, assignation) sont de petits composants clients qui appellent l'API puis relisent la page (`router.refresh()`), sans état local à synchroniser. Le sélecteur de statut ne propose que les transitions autorisées, grâce à la machine à états partagée. Si un autre agent a changé le ticket entre-temps, l'erreur de l'API (409) s'affiche et la page relit l'état réel. Le cache TanStack Query et l'affichage immédiat (*optimistic update*) arrivent au Jalon 3 avec le temps réel.
- **Portail client** : chaque organisation a un portail public (`/portal/acme`) où ses clients créent eux-mêmes leur compte (`POST /auth/register-customer`, toujours avec le rôle `CUSTOMER` : un rôle envoyé dans la requête est refusé), ouvrent des demandes et suivent la conversation. Il n'y a pas d'API dédiée : les mêmes routes que les agents (`GET /tickets`, messages…) renvoient au client ses seuls tickets, sans les notes internes. Après la connexion, chacun est redirigé selon son rôle (client → portail, agent → son espace), et une session expirée sur le portail renvoie vers la connexion du portail.
- **Temps réel (Socket.io)** : la gateway partage le port de l'API. L'authentification se fait **au handshake** : le navigateur envoie le cookie `httpOnly` de l'access token (`withCredentials`), vérifié par le même code que `JwtAuthGuard` ; sans jeton valide, la connexion est refusée. Chaque événement part vers une **room**, jamais vers tous les sockets :
  - `tenant:<id>:agents` (agents et admins, rejointe à la connexion) reçoit `ticket.created` et `ticket.updated` ;
  - `ticket:<id>` (client et agents qui suivent le ticket) reçoit `message.created` et `ticket.updated` ;
  - `ticket:<id>:agents` reçoit les **notes internes** : elles ne sont jamais émises vers une room où se trouve un client, au lieu de compter sur le navigateur pour les masquer.

  On suit un ticket avec `ticket.join`, qui applique **la même règle d'accès** que l'API REST (tenant, puis client propriétaire) en ouvrant un contexte tenant pour passer par le client Prisma filtré. Les événements sont émis par un petit `RealtimeService`, **après** le commit de la transaction (jamais un événement pour une écriture annulée), avec les mêmes formes que les réponses REST (types dans `packages/shared`). Les tests e2e connectent de vrais clients Socket.io et vérifient l'isolation tenant et l'absence de fuite des notes internes (le test échoue si on retire le filtrage). Limite assumée : un socket reste connecté après l'expiration de son JWT (15 min) ; à la reconnexion, c'est le nouveau cookie qui est vérifié.
- **Rate limiting** (`@nestjs/throttler`) sur la connexion et l'inscription uniquement : 5 tentatives par minute et par IP, puis **429**. Le compteur est vérifié avant la validation du body et avant toute lecture en base.
- **SeaweedFS** en local pour le stockage objet : API S3, donc le même code fonctionne avec S3 / R2 en production (MinIO ne publie plus d'images Docker).

## Dépannage

- **`port is already allocated`** : un autre projet utilise ce port → modifier la variable correspondante dans `.env` (ex. `MAILPIT_UI_PORT=8027`), puis `docker compose up -d`. Pour trouver le coupable : `docker ps --format '{{.Names}}\t{{.Ports}}' | grep 8026`.
- **`api` reste en `unhealthy`** : `curl localhost:3001/health` indique quelle dépendance est `down` (en général la base : `docker compose ps postgres`).
- **`web` inaccessible alors que l'api répond** : un service n'a pas pu démarrer et Compose a interrompu le lancement → `docker compose ps -a` pour voir lequel est resté en `Created`.
- **`Configuration invalide` au démarrage de l'api** : une variable a été ajoutée au projet → comparer son `.env` avec `.env.example`, puis `docker compose up -d` (recrée les conteneurs avec la nouvelle config).
- **Dépendances incohérentes après un `git pull`** : `bin/pnpm install`, puis `bin/pnpm db:deploy` si de nouvelles migrations sont arrivées.
- **`Cannot find module '@deskflow/shared'`** : le package partagé n'est pas compilé (son `dist/` n'est pas versionné, il est construit par `pnpm install`) → `bin/pnpm --filter @deskflow/shared build`.
- **`Cannot find module '.../src/generated/prisma/...'`** : le client Prisma n'est pas généré (il n'est pas versionné) → `bin/pnpm db:generate`.
- **Repartir de zéro** : `docker compose down -v && rm -rf node_modules apps/*/node_modules && bin/pnpm install`.

## Pistes d'amélioration

- **Cookies en production** : en dev, le front et l'API partagent `localhost`, donc les cookies posés par l'API sont visibles du serveur Next.js. En production, il faudra servir les deux sur le même site (ex. `app.exemple.com` et `api.exemple.com`, avec l'attribut `Domain` sur les cookies) ou faire passer l'API par le serveur Next.js.
- **Recherche** : seuls les sujets sont indexés. Chercher aussi dans les messages demanderait un `tsvector` sur les messages (ou un moteur dédié si les volumes explosent). Pour un tenant avec énormément de résultats, la recherche passerait entièrement en SQL (filtres et pagination compris) plutôt que de transmettre la liste des identifiants trouvés.
- **Rate limiting multi-instances** : les compteurs sont en mémoire, donc propres à chaque instance de l'API. Avec plusieurs instances (Jalon 3), il faudra les partager dans Redis (stockage Redis pour `@nestjs/throttler`).

## Feuille de route

- [x] Jalon 0 — Socle : monorepo, Docker Compose, apps api / web
- [x] Jalon 0 — Prisma : schéma Tenant / User, première migration (+ pgvector), seed
- [x] Jalon 0 — Config typée et validée au démarrage (`@nestjs/config` + zod)
- [x] Jalon 0 — Endpoint `/health` (`@nestjs/terminus`) + healthcheck Docker
- [x] Jalon 0 — CI GitHub Actions : lint → typecheck → tests → build → tests e2e sur un vrai Postgres
- [x] Jalon 1 — Authentification et multi-tenant : inscription, JWT + refresh tokens (rotation, détection de vol), guards, isolation tenant, invitations, rate limiting, pages front
- [x] Jalon 2 — Tickets et messages : numérotation par tenant, machine à états, liste (filtres, recherche plein texte, curseur), messages et notes internes, erreurs et logs, espace agents et portail client
- [ ] Jalon 3 — Temps réel et pièces jointes
- [ ] Jalon 4 — Traitements asynchrones
- [ ] Jalon 5 — Assistant IA (RAG)
- [ ] Jalon 6 — Analytics, finition, déploiement

# Déploiement de la démo

La démo tourne sur **une seule VM gratuite** (Oracle Cloud *Always Free*), avec les mêmes images et le même Docker Compose qu'en local. Caddy, placé devant, obtient et renouvelle les certificats HTTPS. L'adresse est un sous-domaine gratuit **DuckDNS**.

```
                        ┌──────────────────────── VM Oracle (Docker Compose) ──────────────────────┐
Navigateur ── HTTPS ──▶ │ Caddy ─┬─ DOMAIN ────────▶ web (Next.js) ──▶ api                         │
                        │        ├─ api.DOMAIN ────▶ api (REST + WebSocket) ─┬─▶ postgres          │
                        │        ├─ s3.DOMAIN ─────▶ s3 (SeaweedFS)          ├─▶ redis ◀── worker  │
                        │        └─ mail.DOMAIN ───▶ mailpit                 └─▶ s3, mailpit       │
                        └──────────────────────────────────────────────────────────────────────────┘
```

## Pourquoi une VM plutôt que des services managés gratuits

| Besoin | Services managés gratuits | VM Always Free |
|---|---|---|
| API toujours disponible | mise en veille après 15 min d'inactivité (Render), réveil en ~1 min | toujours allumée |
| Worker BullMQ | pas d'instance gratuite pour un worker | un conteneur de plus |
| Redis | 500 000 commandes/mois (Upstash), vite consommées par BullMQ et le pub/sub Socket.io | Redis complet |
| Postgres | base gratuite supprimée au bout de 30 jours (Render) | volume persistant |
| Cookies | front et API sur des domaines différents | deux sous-domaines du même site |
| Écart avec le local | une configuration par hébergeur | même `docker-compose.prod.yml` |

Ce choix a un coût : il faut une carte bancaire pour vérifier l'identité à l'inscription chez Oracle (rien n'est débité tant qu'on reste dans l'offre gratuite), et il faut administrer soi-même la VM.

## Adresses

Toutes les adresses dérivent de `DOMAIN` (par exemple `deskflow-demo.duckdns.org`) :

| Adresse | Service |
|---|---|
| `https://DOMAIN` | front |
| `https://api.DOMAIN` | API, WebSocket et documentation (`/docs`) |
| `https://s3.DOMAIN` | stockage des pièces jointes (URL présignées) |
| `https://mail.DOMAIN` | boîte mail de la démo (Mailpit) |

**Cookies** : le front et l'API sont deux sous-domaines du même site. `duckdns.org` figure dans la [Public Suffix List](https://publicsuffix.org/list/), donc `DOMAIN` est un site à part entière et ses cookies ne sont pas partagés avec les autres utilisateurs de DuckDNS. L'API pose les cookies de session avec `Domain=DOMAIN` (variable `COOKIE_DOMAIN`). Le navigateur les envoie ainsi à l'API, mais aussi au serveur Next.js, qui en a besoin pour le rendu côté serveur. Ils restent `httpOnly`, `secure` et `sameSite=lax`.

**E-mails** : en production aussi, Mailpit capture les e-mails sans jamais les envoyer. La démo ne peut donc pas servir à envoyer des e-mails à des tiers. Les invitations et les notifications de réponse se lisent sur `mail.DOMAIN`.

## Mise en place (une seule fois)

### 1. Sous-domaine DuckDNS

1. Se connecter sur [duckdns.org](https://www.duckdns.org) (avec un compte GitHub, par exemple).
2. Créer un sous-domaine, par exemple `deskflow-demo`. Son adresse IP sera renseignée à l'étape 3.

DuckDNS fait aussi pointer tous les sous-domaines (`api.deskflow-demo.duckdns.org`, etc.) vers la même adresse.

### 2. VM Oracle Cloud

1. Créer un compte sur [oracle.com/cloud/free](https://www.oracle.com/cloud/free/). La *home region* ne pourra plus être changée : en choisir une proche qui propose les instances Ampere A1.
2. **Compute → Instances → Create instance** :
   - image : **Ubuntu 24.04** (version aarch64) ;
   - shape : **VM.Standard.A1.Flex**, 2 OCPU et 12 Go de RAM (l'offre gratuite autorise jusqu'à 4 OCPU et 24 Go au total) ;
   - ajouter sa clé SSH publique.

   Si Oracle répond *Out of capacity*, réessayer plus tard ou dans un autre *availability domain*.
3. Noter l'**adresse IP publique** de l'instance et la renseigner dans DuckDNS.
4. **Ouvrir les ports 80 et 443** : *Networking → Virtual cloud networks →* le VCN de l'instance *→ Security Lists → Default → Add Ingress Rules* : source `0.0.0.0/0`, TCP, ports `80,443`.

### 3. Préparer le serveur

```sh
ssh ubuntu@<ip>

# Les images Ubuntu d'Oracle bloquent tout sauf SSH dans iptables : ouvrir le web
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

# Docker (script officiel) ; se reconnecter ensuite pour utiliser docker sans sudo
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
exit
```

### 4. Déployer

```sh
ssh ubuntu@<ip>
git clone https://github.com/KyNaOo/deskflow.git && cd deskflow

# Configuration : DOMAIN et les secrets (CHANGE_ME → `openssl rand -hex 32`)
cp deploy/.env.example .env
nano .env

# Construit les images sur la VM (ARM), applique les migrations et démarre tout
docker compose up -d --build

# Données de démo (comptes listés dans le README)
docker compose run --rm migrate prisma db seed
```

Au premier démarrage, Caddy demande les certificats à Let's Encrypt, ce qui prend quelques secondes. Vérifier ensuite que `https://api.DOMAIN/health` répond `{"status":"ok",…}`.

### 5. Remise à zéro quotidienne de la démo

Les visiteurs modifient les données de la démo. Chaque nuit, la base est donc vidée et les données de démo rechargées :

```sh
crontab -e
# Ajouter :
0 4 * * * /home/ubuntu/deskflow/deploy/reset-demo.sh >> /home/ubuntu/reset-demo.log 2>&1
```

Le script se lance aussi à la main : `deploy/reset-demo.sh`.

## Mettre à jour

```sh
cd deskflow && git pull && docker compose up -d --build
```

Les migrations s'appliquent au démarrage (service `migrate`), avant l'API et le worker.

## Sécurité

- **Seul Caddy est exposé** (ports 80 et 443). Postgres, Redis, le stockage et l'API ne sont joignables que par le réseau Docker (`ports: !reset []` dans `docker-compose.deploy.yml`).
- **Secrets** : uniquement dans le `.env` du serveur, jamais dans Git. Le front ne reçoit que des adresses publiques.
- **Derrière le proxy** : l'API lit l'IP du client dans `X-Forwarded-For` (`TRUST_PROXY`), sans quoi le rate limiting compterait tous les visiteurs comme une seule IP, celle de Caddy.
- La documentation `/docs` est en lecture seule en production.

## Limites de l'offre gratuite

- **Récupération des instances inactives** : Oracle peut récupérer une instance *Always Free* dont l'utilisation reste très faible pendant 7 jours (CPU sous 20 %, par exemple). Passer le compte en *Pay As You Go* lève cette règle sans rien facturer tant que l'utilisation reste dans les limites gratuites.
- **Capacité ARM** : la création d'une instance A1 peut échouer faute de capacité dans la région.
- **Une seule machine** : pas de redondance. Une panne de la VM coupe la démo, ce qui est acceptable pour une vitrine. Les données sont rechargées chaque nuit de toute façon.
- **Stockage** : les fichiers envoyés pendant la journée restent dans le bucket après la remise à zéro de la base (voir les pistes d'amélioration du README).

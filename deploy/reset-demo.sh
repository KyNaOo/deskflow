#!/usr/bin/env sh
# Remet la démo à zéro : base vidée, migrations rejouées, données de démo rechargées.
# À la main : deploy/reset-demo.sh ; chaque nuit, dans la crontab du serveur :
#   0 4 * * * /home/ubuntu/deskflow/deploy/reset-demo.sh >> /home/ubuntu/reset-demo.log 2>&1
set -e
cd "$(dirname "$0")/.."
compose() {
  docker compose -f docker-compose.prod.yml -f docker-compose.deploy.yml "$@"
}

compose run --rm migrate prisma migrate reset --force
compose run --rm migrate prisma db seed

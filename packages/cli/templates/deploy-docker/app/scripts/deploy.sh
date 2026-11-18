#!/usr/bin/env sh
# Deploys __APP_NAME__ without downtime, on the server, from this checkout:
#   sh apps/__APP_NAME__/scripts/deploy.sh
#
# Needs Docker Compose 2.24 or newer and the docker-rollout plugin
# (https://github.com/wowu/docker-rollout). Secrets come from the environment or `.env` beside
# compose.yaml, for example `op run --env-file=.op-env -- sh scripts/deploy.sh`.
#
# Builds the new images, runs the migrations while the old release keeps serving (so every
# migration must work with the old release's code), then starts the new release, waits for it to
# be healthy, drains the old one and removes it.
set -eu
cd "$(dirname "$0")/.."

export COMPOSE_FILE=compose.yaml:compose.prod.yaml
# Setting COMPOSE_FILE stops compose loading compose.override.yaml by itself; add it back, last.
if [ -f compose.override.yaml ]; then
  COMPOSE_FILE="${COMPOSE_FILE}:compose.override.yaml"
fi

# Every image the project builds, add-ons' included.
docker compose build
docker compose up -d --remove-orphans postgres proxy
# stacks:slot services
docker compose run --rm migrate

# The old container's health check fails once /tmp/drain exists, so Traefik stops sending it
# requests; the sleep outlasts the check's interval × retries before it gets SIGTERM.
docker rollout --pre-stop-hook "touch /tmp/drain && sleep 15" app

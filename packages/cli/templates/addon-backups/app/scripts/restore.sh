#!/usr/bin/env sh
# Replaces __APP_NAME__'s database with one restored from its pgBackRest repository, on the server,
# from this checkout. Every argument but --yes goes to `pgbackrest restore`:
#
#   sh apps/__APP_NAME__/scripts/restore.sh                    the newest backup and all WAL since
#   sh apps/__APP_NAME__/scripts/restore.sh --type=time "--target=2026-01-31 09:30:00+00"
#   sh apps/__APP_NAME__/scripts/restore.sh --set=<label> --type=immediate   one backup, as taken
#
# It stops the app, the backups and Postgres, restores over the data volume (only the files that
# differ are copied), starts Postgres and waits for it to replay the WAL, then starts the rest,
# migrations first. List the backups and their labels with
#   docker compose exec backup pgbackrest --stanza=main info
set -eu
cd "$(dirname "$0")/.."

export COMPOSE_FILE=compose.yaml:compose.prod.yaml
if [ -f compose.override.yaml ]; then
  COMPOSE_FILE="${COMPOSE_FILE}:compose.override.yaml"
fi

if [ "${1:-}" = "--yes" ]; then
  shift
else
  printf 'This replaces the database with the backup (%s).\nType "restore" to go on: ' "${*:-newest}"
  read -r answer
  if [ "$answer" != "restore" ]; then
    echo "Nothing changed."
    exit 1
  fi
fi

# Postgres pauses, read-only, when it reaches a recovery target; open the database instead.
promote=""
for arg in "$@"; do
  case "$arg" in
    --type=default | --type=preserve | --type=standby) ;;
    --type=*) promote="--target-action=promote" ;;
  esac
done

docker compose build postgres
docker compose stop app backup postgres
docker compose run --rm --no-deps --user postgres --entrypoint pgbackrest postgres \
  --stanza=main --delta restore ${promote} "$@"

docker compose up -d postgres
echo "Waiting for Postgres to replay the WAL and open the database..."
until docker compose exec -T postgres pg_isready -q -U "${POSTGRES_USER:-postgres}"; do
  sleep 5
done

# The app waits for the migrations, which bring a restored schema up to this release's.
docker compose up -d backup app
echo "Restored. Take a full backup of the new timeline:"
echo "  docker compose exec backup pgbackrest --stanza=main --type=full backup"

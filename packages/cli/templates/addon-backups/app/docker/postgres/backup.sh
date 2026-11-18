#!/usr/bin/env sh
# The `backup` service: sets up the stanza in the S3 repository, then backs up forever. A full
# backup when the newest is older than BACKUP_FULL_EVERY_DAYS (7), a differential one otherwise,
# every BACKUP_INTERVAL seconds (12 hours). Retention (pgbackrest.conf) expires the old ones.
set -eu

STANZA="${PGBACKREST_STANZA:-main}"
INTERVAL="${BACKUP_INTERVAL:-43200}"
FULL_EVERY_DAYS="${BACKUP_FULL_EVERY_DAYS:-7}"

echo "Waiting for Postgres..."
until pg_isready -q -h /var/run/postgresql -U "${PGBACKREST_PG1_USER:-postgres}"; do
  sleep 2
done

# Idempotent. It fails when the repository holds this stanza for another cluster, as after the
# data volume was wiped and Postgres started empty: that needs a person, not a retry.
if ! pgbackrest --stanza="$STANZA" stanza-create; then
  echo "stanza-create failed. If the database was recreated on purpose, run" >&2
  echo "  docker compose exec backup pgbackrest --stanza=$STANZA stanza-upgrade" >&2
  echo "If it wasn't, restore it: see docker/postgres/README.md." >&2
  exit 1
fi
# Proves WAL archiving reaches the repository.
pgbackrest --stanza="$STANZA" check

# The type of the next backup: full when no full backup is newer than FULL_EVERY_DAYS.
next_type() {
  newest=$(pgbackrest --stanza="$STANZA" --output=json info |
    jq '[.[0].backup[]? | select(.type == "full") | .timestamp.stop] | max // 0') || true
  # No answer from the repository: try a full one, which reports why it can't.
  newest="${newest:-0}"
  if [ $(($(date +%s) - newest)) -ge $((FULL_EVERY_DAYS * 86400)) ]; then
    echo full
  else
    echo diff
  fi
}

while true; do
  type=$(next_type)
  echo "Starting a $type backup at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # A failure is logged and retried next time, rather than restarting the service.
  pgbackrest --stanza="$STANZA" --type="$type" backup || echo "The $type backup failed" >&2
  sleep "$INTERVAL"
done

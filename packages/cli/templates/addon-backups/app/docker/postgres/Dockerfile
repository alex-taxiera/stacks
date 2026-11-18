# syntax=docker/dockerfile:1

# Production Postgres with pgBackRest (compose.prod.yaml): the server archives each WAL segment to
# the S3 repository, and the `backup` service, from this same image, takes the backups. Built on
# the image development uses, so a data directory moves between them as it is.
FROM __IMAGE[postgres]__

RUN apk add --no-cache pgbackrest jq

# The data directory is the image's own (PGDATA), so it follows a new Postgres major.
ENV PGBACKREST_PG1_PATH=${PGDATA}

COPY pgbackrest.conf /etc/pgbackrest/pgbackrest.conf
COPY --chmod=755 backup.sh /usr/local/bin/backup.sh

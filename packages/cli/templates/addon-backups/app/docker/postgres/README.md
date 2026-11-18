# Backups

In production (`compose.prod.yaml`), Postgres runs this image, which adds
[pgBackRest](https://pgbackrest.org) to the one development uses. Together they keep a
repository in an S3 bucket from which the database can be restored to any moment since the oldest
backup:

- **Postgres archives every WAL segment** to the repository as it fills (`archive_command`).
- **The `backup` service takes the backups**: a full one weekly and a differential one every 12
  hours (`backup.sh`). Four full backups are kept, with everything that goes with them
  (`pgbackrest.conf`).

Development (`compose.yaml` alone) has neither, and needs no bucket.

## Set it up

Make a bucket (its name can't have dots) and a key that can read and write it. Then set these in
`.env` beside `compose.yaml` on the server, or in the environment `scripts/deploy.sh` runs in:

| Variable                 | What                                                      |
| ------------------------ | --------------------------------------------------------- |
| `BACKUP_S3_BUCKET`       | The bucket. Backups go under `/__APP_NAME__` in it.       |
| `BACKUP_S3_KEY`          | The access key's id.                                      |
| `BACKUP_S3_KEY_SECRET`   | The access key's secret.                                  |
| `BACKUP_S3_ENDPOINT`     | The S3 host; `s3.amazonaws.com` unless set.               |
| `BACKUP_S3_REGION`       | The bucket's region; `us-east-1` unless set.              |
| `BACKUP_S3_URI_STYLE`    | `host` unless set; `path` for MinIO and the like.         |
| `BACKUP_INTERVAL`        | Seconds between backups; 43200 (12 hours) unless set.     |
| `BACKUP_FULL_EVERY_DAYS` | Days between full backups; 7 unless set.                  |

Any S3-compatible store works:

- **Cloudflare R2**: `<account id>.r2.cloudflarestorage.com`, region `auto`.
- **Backblaze B2**: `s3.<region>.backblazeb2.com` and its region.
- **MinIO**: its host, with `BACKUP_S3_URI_STYLE=path`.

The next deploy builds the image and starts `backup`, which creates the repository's stanza and
checks that archiving reaches it. Watch it with `docker compose logs -f backup`.

The commands below run on the server, in `apps/__APP_NAME__`, with
`COMPOSE_FILE=compose.yaml:compose.prod.yaml` set as `scripts/deploy.sh` sets it.

## Look at the backups

```sh
docker compose exec backup pgbackrest --stanza=main info
```

## Back up now

```sh
docker compose exec backup pgbackrest --stanza=main --type=full backup
```

## Restore

`scripts/restore.sh` does every step. It asks first, unless it's given `--yes`. Agents load the
`restore-__APP_NAME__` skill (`.agents/skills/restore-__APP_NAME__`), which says how to choose what
to restore and how to check the result.

```sh
sh scripts/restore.sh                                                # the newest state
sh scripts/restore.sh --type=time "--target=2026-01-31 09:30:00+00"  # a moment in time
sh scripts/restore.sh --set=<label> --type=immediate                 # one backup, as taken
```

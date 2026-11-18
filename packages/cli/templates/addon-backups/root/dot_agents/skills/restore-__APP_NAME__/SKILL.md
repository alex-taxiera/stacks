---
name: restore-__APP_NAME__
description: Restore __APP_TITLE__'s production database (apps/__APP_NAME__) from its pgBackRest backups in S3 - to the newest state, to a moment before something went wrong, or onto a new server - and check the backups themselves. Use whenever the user wants to restore, roll back, recover or undo data in __APP_TITLE__'s database, recover from a dropped table, a bad migration or deleted rows, move the database to another server, or asks whether backups are working, when the last one ran, or why the backup service is failing, even if they do not say "restore" or "pgBackRest".
---

# Restoring __APP_TITLE__'s database

Production Postgres (`apps/__APP_NAME__/compose.prod.yaml`) archives every WAL segment to an S3
repository with pgBackRest, and the `backup` service takes a full backup weekly and a
differential one every 12 hours. So the database can go back to **any moment** since the oldest
full backup kept, not only to a backup. `apps/__APP_NAME__/docker/postgres/README.md` has the
setup and the settings; `apps/__APP_NAME__/scripts/restore.sh` does the restore.

Hold on to these throughout:

- **A restore replaces the database.** Everything written after the target is gone from it.
  Show the user what you'll restore to and what that loses, and get a yes before running
  `restore.sh`, every time. Looking (`info`, logs) needs no permission.
- **It runs on the server**, in `apps/__APP_NAME__` of the deployed checkout, with
  `COMPOSE_FILE=compose.yaml:compose.prod.yaml` (`restore.sh` and `deploy.sh` set it themselves;
  set it for any other `docker compose` command). If you can't reach the server, give the user
  the commands to run.
- **The app is down while it runs**: `restore.sh` stops the app, the backups and Postgres, and
  starts them again at the end.
- **Never delete the repository's contents or the data volume** to make something work. A stanza
  error after a wiped volume is fixed by restoring, or by `stanza-upgrade` once the user confirms
  the old data is unwanted.

## 1. Understand what went wrong

Ask, or work out from what the user says:

- **What happened and when**, in UTC. A bad deploy's time is in the deploy log or
  `docker compose ps`; a bad delete's from the app's logs or the user.
- **What is affected**: the whole database, or a few rows of one table? For a few rows, a full
  restore throws away everything else written since. Offer to restore onto a second server or a
  scratch Compose project (section 5), copy the rows out with `pg_dump --table` or `COPY`, and
  load them into production.

## 2. Look at the backups

```sh
docker compose exec backup pgbackrest --stanza=main info
```

It lists each backup's label (`20260131-023000F`, `…F_20260201-143000D`), its type (full or diff),
when it started and stopped, and the WAL range the repository holds. The restore target must be
after the oldest backup's stop time and before the newest archived WAL.

If `backup` isn't running, `docker compose run --rm --no-deps --entrypoint pgbackrest backup --stanza=main info` reads the same repository.

## 3. Choose the target

| The user wants                          | Arguments                                              |
| --------------------------------------- | ------------------------------------------------------ |
| The newest state (a lost volume, a new server) | none                                            |
| Just before a mistake at a known time   | `--type=time "--target=2026-01-31 09:29:00+00"`        |
| Exactly one backup, as it was taken     | `--set=<label> --type=immediate`                       |

For a moment in time, pick one a little before the mistake: a minute before a bad delete, or the
time the deploy started for a bad migration. `restore.sh` adds `--target-action=promote`, so the
database opens when it reaches the target instead of pausing read-only.

If the database is still up, take a backup first, so the state you're leaving can be recovered
too:

```sh
docker compose exec backup pgbackrest --stanza=main --type=incr backup
```

## 4. Restore

Say exactly what will happen: the target, that everything after it is lost, and that the app is
down meanwhile. Get a yes. Then:

```sh
sh scripts/restore.sh --yes --type=time "--target=2026-01-31 09:29:00+00"
```

It builds the image, stops the app, the backups and Postgres, and restores over the data volume
(`--delta`: only the files that differ are copied). It then starts Postgres and waits while it
replays the WAL up to the target, which can take a while for a big gap. Last, it starts the app,
whose migrations run first, and the backups.

Then:

1. **Check the app**: `docker compose ps app` shows it `healthy` once `/api/health` answers. Ask
   the user to look at the data the restore was for.
2. **Take a full backup** of the new timeline:
   `docker compose exec backup pgbackrest --stanza=main --type=full backup`.
3. **Check the backups resumed**: `docker compose logs --tail 50 backup` shows `check` passing.

## 5. Restore onto a new server or a scratch project

On a new server, restore **before** the first `scripts/deploy.sh`. Otherwise deploy starts
Postgres, which creates an empty database, and the `backup` service then refuses the repository
(stanza mismatch). Check out the repo, put the same `BACKUP_S3_*` settings and `POSTGRES_*`
password in `.env`, then run `sh scripts/restore.sh --yes` and `sh scripts/deploy.sh`.

To get a few rows back without touching production, restore into a scratch Compose project,
which has its own empty data volume. Don't use `restore.sh` for this: it starts that project's
`backup` service, and archiving, which would write the copy's WAL and backups into production's
repository. Restore with archiving off and start Postgres without it:

```sh
export COMPOSE_PROJECT_NAME=__APP_NAME__-restore
docker compose run --rm --no-deps --user postgres --entrypoint pgbackrest postgres \
  --stanza=main restore --type=time "--target=2026-01-31 09:29:00+00" \
  --target-action=promote --archive-mode=off
docker compose run -d --no-deps --name __APP_NAME__-restore-db postgres postgres
docker exec __APP_NAME__-restore-db pg_dump -U postgres --data-only --table=<table> __APP_NAME__ > rows.sql
```

Load what's needed into production with the user, then remove the copy:
`docker rm -f __APP_NAME__-restore-db && docker compose down -v`, with `COMPOSE_PROJECT_NAME`
still set. Never run `down -v` in production's project.

## When something fails

- **`backup` exits saying stanza-create failed**: the repository has this stanza for another
  cluster. Either the data volume was recreated, so restore (section 4), or the database was
  deliberately started afresh and the user confirms the old one is unwanted:
  `docker compose run --rm --no-deps --entrypoint pgbackrest backup --stanza=main stanza-upgrade`.
- **`check` or `archive-push` errors in the logs**: the bucket, keys, region or endpoint are
  wrong, or the key can't write. Compare `.env` with `docker/postgres/README.md`. Postgres keeps
  each WAL segment until it is archived, so the disk fills while this lasts; fix it promptly and
  watch `docker compose logs -f backup`.
- **`unable to find backup set with stop time less than`**: the target is before the oldest backup.
  Pick a later target, or `--set` the oldest backup.
- **Postgres never becomes ready after a restore**: read `docker compose logs postgres`. A missing
  WAL segment stops recovery: restore to an earlier target, before the gap.
- **The app fails its health check after a restore**: the migrations or the app can't work with
  the restored schema. Read `docker compose logs migrate app`, and roll the code back to the
  release that matches, or forward with a fix.

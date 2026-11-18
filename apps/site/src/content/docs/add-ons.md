---
title: Add-ons
description: Optional pieces an app takes with --with, and what each one needs.
order: 3
appendix: addons
---

An add-on is an optional piece of an app. Pass add-ons with `--with` when you make the app:

```sh
pnpm stacks add spa web --deploy cloudflare --with e2e,worker
```

In a terminal, the add-on question is a multiselect. It greys out any add-on that the deploy
target or the repo rules out.

- **`e2e`** (spa, start): Playwright tests of whole flows in Chromium, with a CI job. A `start`
  app's tests bring their own Postgres.
- **`zustand`** (spa, start, tauri): a store for state that components share.
- **`sentry`** (spa, start): errors and performance from the browser, and from a `start` app's
  server under Docker.
- **`backups`** (start): Postgres backups to an S3 bucket with pgBackRest. Needs
  `--deploy docker`.
  - In production, Postgres archives its WAL and a `backup` service takes a full backup weekly
    and a differential one every 12 hours, so the database can go back to any moment.
  - Development keeps plain Postgres and needs no bucket.
  - Any S3-compatible store works: AWS, R2, B2, MinIO. Set `BACKUP_S3_*` on the server, as the
    app's `docker/postgres/README.md` says.
  - `scripts/restore.sh` restores, and a `restore-<app>` skill tells agents how to choose a
    target and check the result.
- **`worker`** (spa, astro): a Worker in front of the static site for `/api/*` routes of your own.
  It comes with tests and its own types, and only the paths in `run_worker_first` reach it.
  Needs `--deploy cloudflare`.
- **`downloads`** (astro): a download page for the repo's first desktop app.
  - It sorts the installers in the app's latest release by system and recommends the visitor's
    own.
  - The site redeploys when the app publishes a release.
  - Add the `tauri` app first.
- **`updater`** (tauri): in-app updates from the app's own GitHub release.
  - Releases are signed with a key that `pnpm --filter <app> updater:keys` makes in `~/.tauri`.
  - `--secrets` gives the key to GitHub.
- **`titlebar`** (tauri): a title bar of the app's own, with the window's buttons, on Windows and
  Linux. macOS keeps its traffic lights over the header.
- **`screenshots`** (tauri): `pnpm --filter <app> screenshots` shoots every story tagged
  `screenshot` from the app's Storybook. It shoots each one in light and dark, into
  `docs/screenshots/<app>`, and comes with a skill that says when to retake them.

Some add-ons bring code into a stack's own files, such as its router or its deploy workflow. They
fill `// stacks:slot <name>` markers that the stack leaves in place, so an add-on never replaces a
file you've changed.

## Every add-on

Read from the CLI's source when this site is built.

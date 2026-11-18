import type { Layer } from "../model.ts";
import { requireApp, requirePorts } from "./require.ts";

/** The steps every job in the generated CI starts with. */
const SETUP_STEPS = [
  { uses: "actions/checkout@__ACTION[actions/checkout]__" },
  { uses: "pnpm/action-setup@__ACTION[pnpm/action-setup]__" },
  {
    uses: "actions/setup-node@__ACTION[actions/setup-node]__",
    with: { "node-version-file": ".nvmrc", cache: "pnpm" },
  },
  { run: "pnpm install --frozen-lockfile" },
];

/**
 * Playwright tests that drive the app in Chromium, in `e2e/`, with a CI job of their own. A spa is
 * tested as built (prerendered pages, served by `vite preview`); a start app through its dev
 * server, with Postgres beside it.
 */
export const addonE2e: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const { devPort } = requirePorts(app);
  const isStart = app.stack === "start";
  const job: Record<string, unknown> = {
    name: `End-to-end (${app.name})`,
    "runs-on": "ubuntu-latest",
    steps: [
      ...SETUP_STEPS,
      { run: `pnpm --filter ${app.name} exec playwright install --with-deps chromium` },
      ...(isStart ? [{ run: `pnpm --filter ${app.name} db:migrate` }] : []),
      { run: `pnpm --filter ${app.name} e2e` },
      {
        // The trace of each failed test: open it with `pnpm exec playwright show-trace`.
        if: "failure()",
        uses: "actions/upload-artifact@__ACTION[actions/upload-artifact]__",
        with: {
          name: `playwright-${app.name}`,
          path: `${app.dir}/test-results/`,
          "retention-days": 7,
        },
      },
    ],
  };
  if (isStart) {
    // Compose's ${…} and Actions' ${{ … }} are theirs, not JavaScript's.
    job.services = {
      postgres: {
        image: "__IMAGE[postgres]__",
        env: { POSTGRES_PASSWORD: "postgres", POSTGRES_DB: app.name },
        ports: ["5432:5432"],
        options:
          "--health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10",
      },
    };
    job.env = {
      DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/${app.name}`,
      BETTER_AUTH_URL: `http://localhost:${devPort}`,
      BETTER_AUTH_SECRET: "end-to-end-tests-only-not-a-real-secret",
    };
  }
  return {
    id: isStart ? "addon-e2e-start" : "addon-e2e-spa",
    packages: {
      app: {
        devDependencies: ["@playwright/test"],
        scripts: { e2e: "playwright test" },
      },
    },
    json: {
      [`${app.dir}/tsconfig.json`]: { include: ["e2e", "playwright.config.ts"] },
    },
    yaml: {
      ".github/workflows/ci.yml": { jobs: { [`e2e-${app.name}`]: job } },
    },
    lines: { ".gitignore": ["test-results/", "playwright-report/"] },
    agents: [
      {
        region: "rules",
        id: `e2e:${app.name}`,
        body: [
          `- **\`apps/${app.name}/e2e\` holds Playwright tests** of whole flows in a real browser:`,
          `  \`pnpm --filter ${app.name} e2e\`${isStart ? ", with Postgres up and migrated" : ""}. A change to a flow`,
          "  updates its test in the same commit. Find elements by role and label (`getByRole`), as a",
          "  user does, not by CSS selectors." +
            (isStart ? " Open pages with the specs' `open()`, which waits for hydration." : ""),
        ].join("\n"),
      },
    ],
  };
};

/** Zustand for state the browser holds that several components share, with a store to copy. */
export const addonZustand: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  return {
    id: "addon-zustand",
    packages: { app: { dependencies: ["zustand"] } },
    agents: [
      {
        region: "rules",
        id: `zustand:${app.name}`,
        body: [
          `- **State in \`apps/${app.name}\` that several components share lives in a Zustand store** in`,
          "  `src/stores/` (`preferences.ts` is the pattern): select the slice a component needs",
          "  (`usePreferences((state) => state.compact)`), never the whole store." +
            (app.stack === "start"
              ? " Server data goes through TanStack Query, never a store; a store is created per\n  module, so it's shared by every request the server renders: keep it to browser state."
              : ""),
        ].join("\n"),
      },
    ],
  };
};

/**
 * Postgres backups with pgBackRest, for a start app on Docker: in production, Postgres archives its
 * WAL to an S3 repository and a `backup` service takes full and differential backups, so the
 * database can be restored to any moment. Development keeps the plain image and needs no bucket.
 * A restore script and a skill cover getting it back.
 */
export const addonBackups: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const image = `${ctx.repo.name}-${app.name}-postgres`;
  const build = { context: "docker/postgres" };
  // Compose fills these in from the environment or `.env`; they aren't JavaScript templates.
  const repository = {
    PGBACKREST_REPO1_S3_BUCKET: "${BACKUP_S3_BUCKET:?set the backup bucket}",
    PGBACKREST_REPO1_S3_KEY: "${BACKUP_S3_KEY:?set the backup bucket's access key id}",
    PGBACKREST_REPO1_S3_KEY_SECRET: "${BACKUP_S3_KEY_SECRET:?set the backup bucket's secret key}",
    PGBACKREST_REPO1_S3_ENDPOINT: "${BACKUP_S3_ENDPOINT:-s3.amazonaws.com}",
    PGBACKREST_REPO1_S3_REGION: "${BACKUP_S3_REGION:-us-east-1}",
    PGBACKREST_REPO1_S3_URI_STYLE: "${BACKUP_S3_URI_STYLE:-host}",
    // pgBackRest connects over the socket, which the official image trusts, as the app's user.
    PGBACKREST_PG1_USER: "${POSTGRES_USER:-postgres}",
  };
  const socket = "postgres-socket:/var/run/postgresql";
  return {
    id: "addon-backups",
    yaml: {
      [`${app.dir}/compose.prod.yaml`]: {
        services: {
          postgres: {
            build,
            image,
            command: [
              "postgres",
              "-c",
              "archive_mode=on",
              "-c",
              "archive_command=pgbackrest --stanza=main archive-push %p",
            ],
            environment: repository,
            volumes: [socket],
          },
          // Backs up on a schedule (docker/postgres/backup.sh), reading the data directory and
          // reaching Postgres through its socket.
          backup: {
            build,
            image,
            user: "postgres",
            entrypoint: ["backup.sh"],
            restart: "unless-stopped",
            environment: {
              ...repository,
              BACKUP_INTERVAL: "${BACKUP_INTERVAL:-43200}",
              BACKUP_FULL_EVERY_DAYS: "${BACKUP_FULL_EVERY_DAYS:-7}",
            },
            volumes: ["postgres-data:/var/lib/postgresql:ro", socket],
            depends_on: { postgres: { condition: "service_healthy" } },
          },
        },
        volumes: { "postgres-socket": {} },
      },
      ".github/workflows/ci.yml": {
        jobs: {
          [`docker-${app.name}`]: {
            steps: [{ run: `docker build ${app.dir}/docker/postgres` }],
          },
        },
      },
    },
    slots: {
      [`${app.dir}/scripts/deploy.sh`]: {
        services: ["docker compose up -d backup"],
      },
    },
    lines: {
      [`${app.dir}/README.md`]: [
        "",
        "## Backups",
        "",
        "Production Postgres backs up to S3 with pgBackRest, and can be restored to any moment since",
        "the oldest backup. `docker/postgres/README.md` says how to set it up, look at the backups and",
        "restore; `scripts/restore.sh` restores.",
      ],
    },
    agents: [
      {
        region: "rules",
        id: `backups:${app.name}`,
        body: [
          `- **\`apps/${app.name}\`'s production database backs up with pgBackRest** to an S3 bucket: Postgres`,
          "  archives its WAL, and the `backup` service takes the backups (`docker/postgres`). To",
          `  restore, check the backups, or fix the \`backup\` service, load the \`restore-${app.name}\` skill`,
          `  (\`.agents/skills/restore-${app.name}\`). Never restore, or run \`scripts/restore.sh\`, without the`,
          "  user's yes: it replaces the database.",
        ].join("\n"),
      },
    ],
  };
};

/** Sentry's browser setup: errors and page-load timings, once the build has a DSN. */
const sentryBrowserInit = (indent = "") =>
  [
    "// Errors and page loads go to Sentry when the build has a DSN (VITE_SENTRY_DSN, in",
    "// .env.production; empty leaves it off).",
    "if (!router.isServer && import.meta.env.VITE_SENTRY_DSN && !Sentry.getClient()) {",
    "  Sentry.init({",
    "    dsn: import.meta.env.VITE_SENTRY_DSN,",
    "    integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],",
    "    tracesSampleRate: 0.1,",
    "  });",
    "}",
  ].map((line) => (line ? indent + line : line));

/**
 * Sentry: the browser everywhere, and a start app's server under Docker, loaded before the app
 * with `node --import`. A Worker's server needs `@sentry/cloudflare`, which this doesn't set up.
 */
export const addonSentry: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const isStart = app.stack === "start";
  const onDocker = isStart && app.deploy === "docker";
  const sdk = isStart ? "@sentry/tanstackstart-react" : "@sentry/react";
  const entry = isStart ? `${app.dir}/src/router.tsx` : `${app.dir}/src/main.tsx`;
  const slots: Record<string, Record<string, string[]>> = {
    [entry]: {
      imports: [`import * as Sentry from "${sdk}";`],
      router: sentryBrowserInit(),
    },
  };
  if (onDocker) {
    slots[`${app.dir}/Dockerfile`] = {
      stages: [
        "# The Sentry SDK the server loads before the app (instrument.server.mjs), installed as a",
        "# package: the copy Nitro bundles into .output can't be loaded with `--import`.",
        "FROM base AS sentry",
        "WORKDIR /sentry",
        "RUN --mount=type=bind,from=deps,source=/repo,target=/repo \\",
        "  --mount=type=cache,target=/root/.npm \\",
        `  version=$(node -p "require('/repo/${app.dir}/node_modules/${sdk}/package.json').version") \\`,
        `  && npm install --no-save --ignore-scripts "${sdk}@$\{version}"`,
        "",
      ],
      runtime: [
        "COPY --from=sentry --chown=node:node /sentry/node_modules ./node_modules",
        `COPY --chown=node:node ${app.dir}/instrument.server.mjs ./`,
        'ENV NODE_OPTIONS="--import ./instrument.server.mjs"',
      ],
    };
  }
  return {
    id: "addon-sentry",
    templates: onDocker ? "addon-sentry-server" : "addon-sentry",
    packages: {
      app: {
        dependencies: [sdk],
        ...(onDocker
          ? { scripts: { start: "node --import ./instrument.server.mjs .output/server/index.mjs" } }
          : {}),
      },
    },
    slots,
    ...(onDocker
      ? {
          yaml: {
            [`${app.dir}/compose.yaml`]: {
              services: { app: { environment: { SENTRY_DSN: "${SENTRY_DSN:-}" } } },
            },
          },
          lines: {
            [`${app.dir}/.env.example`]: [
              "",
              "# Sentry for the server; the browser's DSN is in .env.production. Empty leaves it off.",
              "SENTRY_DSN=",
            ],
          },
        }
      : {}),
    agents: [
      {
        region: "rules",
        id: `sentry:${app.name}`,
        body: [
          `- **\`apps/${app.name}\` reports to Sentry** once \`.env.production\` has \`VITE_SENTRY_DSN\` (public:`,
          "  it's in the browser bundle)." +
            (onDocker
              ? " The server reads `SENTRY_DSN` from its environment and loads Sentry first, from\n  `instrument.server.mjs`."
              : isStart
                ? " Only the browser reports: a Worker's server needs `@sentry/cloudflare`."
                : ""),
        ].join("\n"),
      },
    ],
  };
};

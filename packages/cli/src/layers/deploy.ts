import type { Layer } from "../model.ts";

/** Static assets on Cloudflare Workers, deployed by a path-filtered workflow. */
export const deployCloudflareStatic: Layer = (ctx) => {
  const name = ctx.app?.name ?? "app";
  return {
    id: "deploy-cloudflare-static",
    packages: {
      app: {
        devDependencies: ["wrangler"],
        scripts: { deploy: "pnpm run build && wrangler deploy" },
      },
    },
    yaml: {
      // Wrangler's local runtime; only `wrangler dev` runs it, and the app only deploys.
      "pnpm-workspace.yaml": { allowBuilds: { workerd: false } },
    },
    lines: { ".gitignore": [".wrangler/"] },
    agents: [
      {
        region: "rules",
        id: `deploy:${name}`,
        body: `- **\`apps/${name}\` deploys to Cloudflare Workers** (static assets, \`wrangler.jsonc\`) from \`trunk\` through \`.github/workflows/deploy-${name}.yml\`, which needs the \`CLOUDFLARE_API_TOKEN\` and \`CLOUDFLARE_ACCOUNT_ID\` secrets.`,
      },
    ],
  };
};

/** GitHub Pages, deployed by a path-filtered workflow. */
export const deployGhPages: Layer = (ctx) => {
  const name = ctx.app?.name ?? "app";
  return {
    id: "deploy-gh-pages",
    agents: [
      {
        region: "rules",
        id: `deploy:${name}`,
        body: `- **\`apps/${name}\` deploys to GitHub Pages** from \`trunk\` through \`.github/workflows/pages-${name}.yml\`. It assumes a custom domain (served from \`/\`); without one, set Vite's \`base\` to \`/<repo>/\`.`,
      },
    ],
  };
};

/** npm, published with provenance from a dispatched release workflow. */
export const releaseNpm: Layer = (ctx) => {
  const name = ctx.app?.name ?? "cli";
  const pkg = ctx.app?.packageName ?? name;
  return {
    id: "release-npm",
    agents: [
      {
        region: "rules",
        id: `release:${name}`,
        body: [
          `- **\`${pkg}\` releases from \`.github/workflows/release-${name}.yml\`**: Actions → Run, pick a bump.`,
          `  It tags \`${name}@v<version>\`, sets the version in \`package.json\` and the skill's`,
          "  `library_version`, publishes to npm with provenance and makes a GitHub release. Never",
          "  edit `version` by hand. Publishing uses npm trusted publishing: add this repo and workflow",
          `  as a trusted publisher of \`${pkg}\` on npmjs.com once, before the first release.`,
        ].join("\n"),
      },
    ],
  };
};

/**
 * A Docker image and Compose files for one server (Postgres, a one-shot migration, the app), plus
 * a production layer with Traefik for rollouts without downtime. The image builds from the repo
 * root, so the app's workspace packages are in it.
 */
export const deployDocker: Layer = (ctx) => {
  const name = ctx.app?.name ?? "app";
  const dockerPort = (ctx.app?.devPort ?? 3000) + 1;
  // Compose fills these in from the environment or `.env`; they aren't JavaScript templates.
  const databaseUrl =
    "postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@postgres:5432/" + name;
  const build = (target: string) => ({
    context: "../..",
    dockerfile: `apps/${name}/Dockerfile`,
    target,
  });
  return {
    id: "deploy-docker",
    lines: { ".gitignore": ["compose.override.yaml", ".op-env"] },
    yaml: {
      // The start stack's compose.yaml has Postgres for development; this adds the app.
      [`apps/${name}/compose.yaml`]: {
        services: {
          // One-shot: applies the migrations, then exits. The app waits for it.
          migrate: {
            build: build("migrate"),
            environment: { DATABASE_URL: databaseUrl },
            depends_on: { postgres: { condition: "service_healthy" } },
          },
          app: {
            build: build("runtime"),
            restart: "unless-stopped",
            ports: ["${APP_PORT:-" + dockerPort + "}:3000"],
            environment: {
              DATABASE_URL: databaseUrl,
              BETTER_AUTH_URL: "${BETTER_AUTH_URL:-http://localhost:" + dockerPort + "}",
              BETTER_AUTH_SECRET: "${BETTER_AUTH_SECRET:-}",
            },
            healthcheck: {
              // Fails once /tmp/drain exists, so a rollout can take the old container out of
              // Traefik's rotation before stopping it.
              test: [
                "CMD-SHELL",
                "test ! -f /tmp/drain && node -e \"fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))\"",
              ],
              interval: "5s",
              timeout: "3s",
              retries: 2,
              start_period: "30s",
              start_interval: "1s",
            },
            // Longer than the server's SERVER_SHUTDOWN_TIMEOUT (30s), so requests finish first.
            stop_grace_period: "35s",
            depends_on: { migrate: { condition: "service_completed_successfully" } },
          },
        },
      },
      ".github/workflows/ci.yml": {
        jobs: {
          [`docker-${name}`]: {
            name: `Docker image (${name})`,
            "runs-on": "ubuntu-latest",
            steps: [
              { uses: "actions/checkout@__ACTION[actions/checkout]__" },
              {
                // Every stage, so the migrate image is checked too.
                run: `docker build --file apps/${name}/Dockerfile --target migrate . && docker build --file apps/${name}/Dockerfile .`,
              },
            ],
          },
        },
      },
    },
    agents: [
      {
        region: "rules",
        id: `deploy:${name}`,
        body: [
          `- **\`apps/${name}\` deploys with Docker Compose** on one server: \`apps/${name}/scripts/deploy.sh\``,
          "  builds the images, runs the migrations while the old release keeps serving, then rolls the",
          "  app over with `docker rollout` behind Traefik. **Every migration must work with the previous",
          "  release's code**: add columns as nullable or with defaults, and drop them a release later.",
        ].join("\n"),
      },
    ],
  };
};

import type { Layer } from "../model.ts";
import { requireApp, requirePorts, requireUi } from "./require.ts";
import {
  CHAKRA,
  REACT,
  REACT_TYPES,
  STORYBOOK,
  storybookScripts,
  TYPESCRIPT,
  VITE_REACT,
} from "./shared.ts";

/** The host port of an app's local Postgres: 5433 for the first app, 5434 for the next. */
export const dbPort = (devPort: number) => 5433 + Math.round((devPort - 3000) / 10);

/**
 * A fullstack app that renders on the server: TanStack Start on Nitro, TanStack Query (the
 * viewer and server data), better-auth (email and password, and email codes) and Drizzle on
 * Postgres. Its deploy target adds the server: Docker or Cloudflare.
 */
export const start: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const { devPort, storybookPort } = requirePorts(app);
  const ui = requireUi(ctx).package;
  const typegen = `pnpm --filter ${ui} typegen`;
  return {
    id: "start",
    packages: {
      app: {
        fields: { imports: { "#/*": "./src/*" } },
        dependencies: [
          ...CHAKRA,
          ...REACT,
          "@tanstack/react-query",
          "@tanstack/react-router",
          "@tanstack/react-router-ssr-query",
          "@tanstack/react-start",
          "better-auth",
          "drizzle-orm",
          "pg",
          "zod",
        ],
        workspaceDependencies: [ui],
        devDependencies: [
          ...REACT_TYPES,
          ...STORYBOOK.filter((name) => name !== "@storybook/react-vite"),
          ...TYPESCRIPT,
          ...VITE_REACT,
          "@storybook/tanstack-react",
          "@tanstack/devtools-vite",
          "@tanstack/react-devtools",
          "@tanstack/react-query-devtools",
          "@tanstack/react-router-devtools",
          "@tanstack/router-cli",
          "@types/pg",
          "dotenv-cli",
          "drizzle-kit",
          "nitro",
        ],
        scripts: {
          dev: `${typegen} && dotenv -e .env.local -- vite dev`,
          build: `${typegen} && vite build && tsc --noEmit`,
          start: "node .output/server/index.mjs",
          "generate-routes": "tsr generate",
          typecheck: `${typegen} && tsr generate && tsc --noEmit`,
          test: "vitest run",
          // drizzle.config.ts reads .env.local itself.
          "db:generate": "drizzle-kit generate",
          "db:migrate": "drizzle-kit migrate",
          "db:studio": "drizzle-kit studio",
          ...storybookScripts(storybookPort),
        },
      },
      // TanStack Router, Start and Query ship skills; Intent serves them.
      root: { fields: { intent: { skills: ["@tanstack/*"] } } },
    },
    lines: { ".gitignore": [".output/", ".nitro/", ".tanstack/"] },
    yaml: {
      // Native builds TanStack Start's dependencies ask for that nothing here needs.
      "pnpm-workspace.yaml": { allowBuilds: { "@parcel/watcher": false } },
    },
    mcp: {
      [`storybook-${app.name}`]: { type: "http", url: `http://localhost:${storybookPort}/mcp` },
    },
    agents: [
      {
        region: "apps",
        id: `app:${app.name}`,
        body: [
          `- \`apps/${app.name}\` (package \`${app.name}\`) — ${app.title}: a fullstack app rendered on the`,
          "  server. TanStack Start on Nitro (file routes in `src/routes`, server functions in",
          "  `src/server/**/*.functions.ts`), TanStack Query, better-auth and Drizzle on Postgres.",
          `  - \`pnpm --filter ${app.name} dev\` (port ${devPort}) needs Postgres on ${dbPort(devPort)}`,
          `    and \`.env.local\` (copy \`.env.example\`); \`apps/${app.name}/README.md\` says how to get both.`,
          `  - Schema in \`src/db/schema.ts\`. After changing it, \`pnpm --filter ${app.name} db:generate\` writes`,
          "    a migration to `drizzle/`; review it and commit both. The app never migrates itself.",
          "  - Server-only code lives in `*.server.ts` files and `src/server/`, and reaches the client",
          "    only through server functions (`createServerFn`). Guard them with `requireUser`",
          "    (`src/server/auth/middleware.ts`).",
          "  - Who's signed in comes from the root route's `viewer` context; after signing in or out,",
          "    call `useRefreshViewer()`.",
          `  - \`src/routeTree.gen.ts\` is generated (\`pnpm --filter ${app.name} generate-routes\`); never edit it.`,
        ].join("\n"),
      },
      {
        region: "mcp",
        id: `storybook-${app.name}`,
        body: `- \`storybook-${app.name}\` — \`apps/${app.name}\`'s Storybook, port ${storybookPort}.`,
      },
    ],
    post: [
      {
        title: `Generating ${app.name}'s route tree`,
        command: "pnpm",
        args: ["--filter", app.name, "generate-routes"],
        needsInstall: true,
      },
      {
        title: `Writing ${app.name}'s first migration`,
        command: "pnpm",
        args: ["--filter", app.name, "db:generate", "--name", "init"],
        needsInstall: true,
      },
    ],
  };
};

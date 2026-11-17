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

/** A client-only app: Vite, TanStack Router, and every page prerendered to static HTML. */
export const spa: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const { devPort, storybookPort } = requirePorts(app);
  const ui = requireUi(ctx).package;
  return {
    id: "spa",
    packages: {
      app: {
        dependencies: [...CHAKRA, ...REACT, "@tanstack/react-router"],
        workspaceDependencies: [ui],
        devDependencies: [
          ...REACT_TYPES,
          ...STORYBOOK,
          ...TYPESCRIPT,
          ...VITE_REACT,
          "@emotion/cache",
          "@tanstack/router-cli",
          "@tanstack/router-plugin",
          "vite-prerender-plugin",
        ],
        scripts: {
          dev: `pnpm --filter ${ui} typegen && vite dev`,
          build: `pnpm --filter ${ui} typegen && vite build && tsc --noEmit`,
          preview: "vite preview",
          "generate-routes": "tsr generate",
          typecheck: `pnpm --filter ${ui} typegen && tsr generate && tsc --noEmit`,
          test: "vitest run",
          ...storybookScripts(storybookPort),
        },
      },
      root: {
        scripts: {
          // One package at a time. vite-prerender-plugin (0.5) builds its prerender in its own
          // package directory, which pnpm shares between apps, and clears it first: two spa
          // builds at once delete each other's files.
          build: "pnpm -r --workspace-concurrency=1 build",
        },
        // TanStack Router ships skills for routing, data loading and the like; Intent serves them.
        fields: { intent: { skills: ["@tanstack/*"] } },
      },
    },
    mcp: {
      [`storybook-${app.name}`]: { type: "http", url: `http://localhost:${storybookPort}/mcp` },
    },
    agents: [
      {
        region: "apps",
        id: `app:${app.name}`,
        body: [
          `- \`apps/${app.name}\` (package \`${app.name}\`) — ${app.title}: a client-only app. Vite,`,
          "  TanStack Router (file routes in `src/routes`) and `vite-prerender-plugin`, which renders",
          "  every page to static HTML after the build (`src/prerender.tsx`).",
          `  - \`pnpm --filter ${app.name} dev\` (port ${devPort}), \`build\`, \`preview\`; Storybook on ${storybookPort}.`,
          "  - Code that runs at import time must be safe in Node: the prerender imports every route.",
          "    A page nothing links to goes in `additionalPrerenderRoutes` in `vite.config.ts`.",
          "  - Page titles and `<meta>` come from each route's `head()`. Links use `RouterLink`",
          "    (`#/components/router-link`), or `LinkButton asChild` around one.",
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
    ],
  };
};

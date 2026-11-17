import type { AppInfo, Layer } from "../model.ts";
import {
  CHAKRA,
  REACT,
  REACT_TYPES,
  STORYBOOK,
  storybookScripts,
  TYPESCRIPT,
  VITE_REACT,
} from "./shared.ts";

function requireApp(app: AppInfo | undefined): AppInfo {
  if (!app) throw new Error("an app layer was applied without an app");
  return app;
}

/** A client-only app: Vite, TanStack Router, and every page prerendered to static HTML. */
export const spa: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const ui = ctx.repo.uiPackage;
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
          ...storybookScripts(app.storybookPort),
        },
      },
    },
    mcp: {
      [`storybook-${app.name}`]: { type: "http", url: `http://localhost:${app.storybookPort}/mcp` },
    },
    agents: [
      {
        region: "apps",
        id: `app:${app.name}`,
        body: [
          `- \`apps/${app.name}\` (package \`${app.name}\`) — ${app.title}: a client-only app. Vite,`,
          "  TanStack Router (file routes in `src/routes`) and `vite-prerender-plugin`, which renders",
          "  every page to static HTML after the build (`src/prerender.tsx`).",
          `  - \`pnpm --filter ${app.name} dev\` (port ${app.devPort}), \`build\`, \`preview\`; Storybook on ${app.storybookPort}.`,
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
        body: `- \`storybook-${app.name}\` — \`apps/${app.name}\`'s Storybook, port ${app.storybookPort}.`,
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

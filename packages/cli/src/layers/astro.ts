import type { Layer } from "../model.ts";
import { requireApp, requirePorts, requireUi } from "./require.ts";
import { CHAKRA, REACT, REACT_TYPES, STORYBOOK, storybookScripts, TYPESCRIPT } from "./shared.ts";

/** A site of pages: Astro, with Markdown content and React islands where a page needs them. */
export const astro: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const { devPort, storybookPort } = requirePorts(app);
  const ui = requireUi(ctx).package;
  const typegen = `pnpm --filter ${ui} typegen`;
  return {
    id: "astro",
    packages: {
      app: {
        dependencies: [...CHAKRA, ...REACT, "astro", "@astrojs/react"],
        workspaceDependencies: [ui],
        devDependencies: [
          ...REACT_TYPES,
          ...STORYBOOK,
          ...TYPESCRIPT,
          "@vitejs/plugin-react",
          "vite",
        ],
        scripts: {
          dev: `${typegen} && astro dev`,
          build: `${typegen} && astro build && tsc --noEmit`,
          preview: "astro preview",
          // `astro sync` writes the content collections' types that `tsc` reads.
          typecheck: `${typegen} && astro sync && tsc --noEmit`,
          test: "vitest run",
          ...storybookScripts(storybookPort),
        },
      },
    },
    lines: { ".gitignore": [".astro/"] },
    mcp: {
      [`storybook-${app.name}`]: { type: "http", url: `http://localhost:${storybookPort}/mcp` },
    },
    agents: [
      {
        region: "apps",
        id: `app:${app.name}`,
        body: [
          `- \`apps/${app.name}\` (package \`${app.name}\`) — ${app.title}: a static site. Astro pages`,
          "  (`src/pages`), Markdown posts (`src/content/posts`, typed in `src/content.config.ts`), and",
          "  React components for anything Chakra draws.",
          `  - \`pnpm --filter ${app.name} dev\` (port ${devPort}), \`build\`, \`preview\`; Storybook on ${storybookPort}.`,
          "  - A React component in a page renders to HTML at build time and ships no JavaScript;",
          "    `client:load` (or `client:visible`) makes it interactive. Ship JavaScript only where a",
          "    component responds to the user.",
          "  - Every React component a page uses directly is its own root, so it wraps itself in",
          `    \`IslandProvider\` (\`${ui}/island\`). The layout renders \`ChakraStyles\` once, in \`<head>\`.`,
          "  - `typecheck` covers `.ts` and `.tsx`, not `.astro` frontmatter: `astro check` needs",
          "    TypeScript 6, and `@astrojs/ts-content-mapper` 7.1. Keep logic in `.ts` files. oxlint and",
          "    oxfmt skip `.astro` files too.",
        ].join("\n"),
      },
      {
        region: "mcp",
        id: `storybook-${app.name}`,
        body: `- \`storybook-${app.name}\` — \`apps/${app.name}\`'s Storybook, port ${storybookPort}.`,
      },
    ],
  };
};

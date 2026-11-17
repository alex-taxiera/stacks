import type { Layer } from "../model.ts";
import { CHAKRA, REACT, REACT_TYPES, STORYBOOK, storybookScripts, TYPESCRIPT } from "./shared.ts";

/** `packages/ui`: the Chakra snippets, theme, provider and shared Storybook preview. */
export const ui: Layer = (ctx) => ({
  id: "ui",
  packages: {
    ui: {
      dependencies: ["@fontsource-variable/inter"],
      devDependencies: [
        ...CHAKRA,
        ...REACT,
        ...REACT_TYPES,
        ...STORYBOOK,
        ...TYPESCRIPT,
        "@chakra-ui/cli",
        "@vitejs/plugin-react",
        "vite",
      ],
      peerDependencies: [...CHAKRA, ...REACT],
      scripts: {
        typegen: "chakra typegen src/theme.ts",
        typecheck: "pnpm run typegen && tsc --noEmit",
        test: "pnpm run typegen && vitest run",
        ...storybookScripts(ctx.ui.storybookPort),
      },
      fields: {
        exports: {
          "./theme": "./src/theme.ts",
          "./storybook": "./src/storybook.tsx",
          "./*": "./src/components/ui/*.tsx",
        },
      },
    },
  },
  mcp: { "storybook-ui": { type: "http", url: `http://localhost:${ctx.ui.storybookPort}/mcp` } },
  agents: [
    {
      region: "mcp",
      id: "storybook-ui",
      body: `- \`storybook-ui\` — \`packages/ui\`'s Storybook, port ${ctx.ui.storybookPort}.`,
    },
  ],
});

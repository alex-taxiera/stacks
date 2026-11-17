import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-themes",
    "@storybook/addon-mcp",
  ],
  framework: "@storybook/react-vite",
  features: {
    // Required by the MCP addon's docs toolset (docs-list, docs-show).
    componentsManifest: true,
  },
  // Shows the shared library's stories (packages/ui, which `pnpm storybook` starts on
  // __UI_STORYBOOK_PORT__) next to the app's. A static build points it at a published copy with
  // STORYBOOK_UI_URL.
  refs: {
    ui: {
      title: "UI library",
      url: process.env.STORYBOOK_UI_URL ?? "http://localhost:__UI_STORYBOOK_PORT__",
    },
  },
};
export default config;

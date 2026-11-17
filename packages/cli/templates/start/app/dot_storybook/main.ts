import type { StorybookConfig } from "@storybook/tanstack-react";
import type { PluginOption } from "vite";

// The framework drops TanStack Start's plugin but not the rest of the app server: Nitro starts a
// module runner that evaluates the preview without Storybook's globals, and the devtools plugin
// starts its own event bus.
const SERVER_ONLY_PLUGIN_PREFIXES = ["nitro:", "fullstack:", "@tanstack/devtools:"];

const isServerOnlyPlugin = (plugin: PluginOption): boolean =>
  Array.isArray(plugin)
    ? plugin.some(isServerOnlyPlugin)
    : typeof plugin === "object" &&
      plugin !== null &&
      "name" in plugin &&
      SERVER_ONLY_PLUGIN_PREFIXES.some((prefix) => plugin.name.startsWith(prefix));

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-themes",
    "@storybook/addon-mcp",
  ],
  framework: "@storybook/tanstack-react",
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
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: (viteConfig.plugins ?? []).filter((plugin) => !isServerOnlyPlugin(plugin)),
  }),
};
export default config;

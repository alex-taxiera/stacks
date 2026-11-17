import type { StorybookConfig } from "@storybook/react-vite";
import type { PluginOption } from "vite";

/** Plugins that only make sense for the app's own build. */
const APP_BUILD_PLUGINS = new Set([
  "vite-prerender-plugin",
  "serve-prerendered-html",
  "drop-prerender-chunks",
  "preload-inter",
  "exit-after-build",
]);

function withoutAppBuildPlugins(plugins: PluginOption[] | undefined): PluginOption[] {
  return (plugins ?? []).flat(Infinity).filter((plugin) => {
    if (!plugin || typeof plugin !== "object" || !("name" in plugin)) return true;
    return !APP_BUILD_PLUGINS.has(plugin.name);
  });
}

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
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: withoutAppBuildPlugins(viteConfig.plugins),
  }),
};
export default config;

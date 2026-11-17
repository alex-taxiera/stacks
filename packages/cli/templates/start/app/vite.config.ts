/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import babel from "@rolldown/plugin-babel";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// Vitest builds a Vite server from this config too; keep the app server (Nitro) and the devtools
// event bus out of test runs.
const isVitest = Boolean(process.env.VITEST);

export default defineConfig({
  resolve: {
    // `#/*` imports, from tsconfig.json's `paths`.
    tsconfigPaths: true,
  },
  plugins: [
    !isVitest && devtools(),
    tanstackStart(),
    // Nitro plugins and tasks live in `server/`. The deploy target picks the preset.
    !isVitest && nitro({ serverDir: "./server" }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  server: { port: __DEV_PORT__, strictPort: !isVitest },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "node", include: ["src/**/*.test.ts"] },
      },
      {
        // Every story is a test: it must render, its play function must pass,
        // and the a11y addon reports what axe finds.
        extends: true,
        plugins: [
          storybookTest({
            configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
            storybookUrl: "http://localhost:__STORYBOOK_PORT__",
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});

/// <reference types="vitest/config" />
// Vitest's and Storybook's config. Astro has its own, in astro.config.ts.
import { fileURLToPath, URL } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // `#/*` imports, from tsconfig.json's `paths`.
    tsconfigPaths: true,
    dedupe: ["@chakra-ui/react", "@emotion/react", "next-themes", "react", "react-dom"],
  },
  plugins: [react()],
  server: { strictPort: false },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        // Every story is a test: it must render, its play function must pass,
        // and the a11y addon reports what axe finds.
        extends: true,
        plugins: [
          storybookTest({
            configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
            storybookUrl: "http://localhost:6009",
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

import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:__DEV_PORT__";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  // The dev server, with the database `.env.local` (or CI's environment) names, migrated.
  webServer: {
    command: "pnpm run dev",
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

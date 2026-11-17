import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:__DEV_PORT__";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  // The built site, prerendered pages and all, as it's deployed.
  webServer: {
    command: "pnpm run build && pnpm run preview",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

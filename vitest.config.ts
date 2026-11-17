import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The templates hold the generated repos' own tests, which run in those repos.
    include: ["test/**/*.test.ts"],
  },
});

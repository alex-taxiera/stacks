import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// The dev server's settings. In Docker, DATABASE_URL comes from Compose, and these files aren't there.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});

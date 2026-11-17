import { defineConfig } from "nitro";

export default defineConfig({
  // Production builds are a Cloudflare Worker. Nitro writes the Worker's config (this, plus the
  // entry and the static assets) to .output/server/wrangler.json, which wrangler then uses here.
  // `vite dev` stays on Node, as other apps do, with DATABASE_URL for the database;
  // `pnpm preview` runs the built Worker in workerd, with its bindings.
  $production: {
    preset: "cloudflare-module",
    cloudflare: {
      wrangler: {
        name: "__REPO_NAME__-__APP_NAME__",
        compatibility_date: "__TODAY__",
        compatibility_flags: ["nodejs_compat"],
        observability: { enabled: true },
        // Postgres, through Hyperdrive's pooled connections. Create the config once with
        // `pnpm exec wrangler hyperdrive create __APP_NAME__ --connection-string="postgres://…"`
        // and put its id here. `pnpm preview` connects to the local database instead.
        hyperdrive: [
          {
            binding: "HYPERDRIVE",
            id: "REPLACE_WITH_THE_HYPERDRIVE_ID",
            localConnectionString:
              "postgresql://postgres:postgres@localhost:__DB_PORT__/__APP_NAME__",
          },
        ],
        // BETTER_AUTH_SECRET is a secret: `pnpm exec wrangler secret put BETTER_AUTH_SECRET`.
        vars: { BETTER_AUTH_URL: "https://example.com" },
      },
    },
  },
});

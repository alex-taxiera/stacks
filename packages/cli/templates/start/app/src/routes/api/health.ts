import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";

import { db } from "#/db";

/**
 * For health checks: answers once the server can reach the database, so a deploy only sends
 * traffic to an app that can serve it.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await db.execute(sql`select 1`);
          return new Response("ok");
        } catch {
          return new Response("database unavailable", { status: 503 });
        }
      },
    },
  },
});

import { getRequest } from "@tanstack/react-start/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

const connect = (connectionString: string) =>
  drizzle({ connection: { connectionString }, schema, casing: "snake_case" });

type Database = ReturnType<typeof connect>;

/** The Worker's bindings, which Nitro's Cloudflare runtime puts here for each request. */
interface WorkerEnv {
  HYPERDRIVE?: { connectionString: string };
}
const workerEnv = () => (globalThis as { __env__?: WorkerEnv }).__env__;

// A Worker can't use a connection one request opened in another, so each request gets its own,
// through Hyperdrive, which keeps the real connections to Postgres warm.
const perRequest = new WeakMap<Request, Database>();
// `vite dev` runs in Node: one pool, from DATABASE_URL.
let local: Database | undefined;

function current(): Database {
  const hyperdrive = workerEnv()?.HYPERDRIVE;
  if (!hyperdrive) {
    local ??= connect(process.env.DATABASE_URL ?? "");
    return local;
  }
  const request = getRequest();
  let database = perRequest.get(request);
  if (!database) {
    database = connect(hyperdrive.connectionString);
    perRequest.set(request, database);
  }
  return database;
}

/**
 * The app's database. Server code only: server functions and API routes, which run inside a
 * request.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, key) {
    const database = current();
    const value: unknown = Reflect.get(database, key);
    return typeof value === "function" ? value.bind(database) : value;
  },
});

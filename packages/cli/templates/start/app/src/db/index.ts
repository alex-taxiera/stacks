import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/** The app's database. Server code only: server functions, API routes and Nitro plugins. */
export const db = drizzle({ client: pool, schema, casing: "snake_case" });

/** Ends the connection pool, so the server can exit (on shutdown). */
export const closeDb = () => pool.end();

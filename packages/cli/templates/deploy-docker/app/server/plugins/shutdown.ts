import { definePlugin } from "nitro";

import { closeDb } from "../../src/db";

/**
 * On SIGTERM (a rollout stopping the old container), Nitro finishes the requests in flight, then
 * runs the close hook: end the database pool, then exit. The server closes but never exits by
 * itself, so without this Docker waits for its grace period and kills it. Only on a signal: in
 * development, Vite closes the app without one when it reloads.
 */
export default definePlugin((nitroApp) => {
  let signalled = false;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      signalled = true;
    });
  }

  nitroApp.hooks.hook("close", async () => {
    await closeDb();
    if (signalled) process.exit(0);
  });
});

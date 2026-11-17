import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeaders, setResponseStatus } from "@tanstack/react-start/server";

import { auth } from "#/lib/auth";

/** Adds the better-auth session, or null, to a server function's context. */
export const sessionMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  return next({ context: { session } });
});

/** Turns away callers who aren't signed in; adds `user` to the context. */
export const requireUser = createMiddleware({ type: "function" })
  .middleware([sessionMiddleware])
  .server(async ({ next, context }) => {
    if (!context.session) {
      setResponseStatus(401);
      throw new Error("Please sign in first.");
    }
    return next({ context: { user: context.session.user } });
  });

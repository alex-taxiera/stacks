import { createServerFn } from "@tanstack/react-start";

import { sessionMiddleware } from "./middleware";

/** Who's looking at the page: the signed-in user, or null. Only what pages need to show. */
export const getViewer = createServerFn({ method: "GET" })
  .middleware([sessionMiddleware])
  .handler(({ context }) => {
    if (!context.session) return { user: null };
    const { id, name, email } = context.session.user;
    return { user: { id, name, email } };
  });

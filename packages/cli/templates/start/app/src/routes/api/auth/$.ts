import { createFileRoute } from "@tanstack/react-router";

import { auth } from "#/lib/auth";

/** better-auth's endpoints: sign-up, sign-in, sessions, email links and codes. */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});

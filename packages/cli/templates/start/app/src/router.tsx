import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
// stacks:slot imports

import { routeTree } from "./routeTree.gen";

/** One router (and query cache) per request on the server, and one in the browser. */
export function getRouter() {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // The query cache decides what's fresh, not the router.
    defaultPreloadStaleTime: 0,
  });
  // Queries a server render fetched go to the browser with the HTML.
  setupRouterSsrQueryIntegration({ router, queryClient });
  // stacks:slot router
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

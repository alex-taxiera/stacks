import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { getViewer } from "#/server/auth/viewer.functions";

/** Who's looking at the page. The root route loads it; every route reads it from context. */
export const viewerQueryOptions = queryOptions({
  queryKey: ["viewer"],
  queryFn: () => getViewer(),
  staleTime: 5 * 60_000,
});

export type Viewer = Awaited<ReturnType<typeof getViewer>>;

/** Call after signing in or out, so route guards and the header read the new session. */
export function useRefreshViewer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async () => {
    queryClient.removeQueries({ queryKey: viewerQueryOptions.queryKey });
    await router.invalidate();
  };
}

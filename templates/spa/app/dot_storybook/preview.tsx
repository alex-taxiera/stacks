import { basePreview, resetUi } from "__UI_PKG__/storybook";
import type { Decorator, Preview } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

/** Every path the app links to. Each renders the story, so following a link stays on it. */
const PATHS = ["/", "/about"];

/** Renders the story inside a router so router links work. */
const withRouter: Decorator = (Story) => {
  const rootRoute = createRootRoute({ component: () => <Story /> });
  const routeTree = rootRoute.addChildren(
    PATHS.map((path) => createRoute({ getParentRoute: () => rootRoute, path })),
  );
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return <RouterProvider router={router} />;
};

const preview: Preview = {
  ...basePreview,
  // Decorators run inside out, so the router sits inside the shared Chakra provider.
  decorators: [withRouter, ...basePreview.decorators],
  beforeEach: () => {
    resetUi();
  },
};

export default preview;

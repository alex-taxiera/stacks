import { Box, Container, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { LinkButton } from "__UI_PKG__/link-button";
import { Provider } from "__UI_PKG__/provider";
import { Toaster } from "__UI_PKG__/toaster";
import type { ReactNode } from "react";

import { Footer } from "#/components/Footer";
import { Header } from "#/components/Header";
import { RouterLink } from "#/components/router-link";
import { authClient } from "#/lib/auth-client";
import { useRefreshViewer, viewerQueryOptions } from "#/lib/viewer";
import { APP_NAME, DESCRIPTION } from "#/site-config";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => ({
    viewer: await context.queryClient.ensureQueryData(viewerQueryOptions),
  }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: DESCRIPTION },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // next-themes sets the colour mode's class on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <Provider>{children}</Provider>
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
            { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  const { viewer } = Route.useRouteContext();
  const refreshViewer = useRefreshViewer();
  const navigate = useNavigate();

  return (
    <Flex direction="column" minH="100dvh">
      <Header
        viewer={viewer}
        onSignOut={async () => {
          await authClient.signOut();
          await refreshViewer();
          await navigate({ to: "/" });
        }}
      />
      <Box as="main" flex={1}>
        <Outlet />
      </Box>
      <Footer />
      <Toaster />
    </Flex>
  );
}

function NotFound() {
  return (
    <Container maxW="lg" py={20}>
      <Stack gap={4} align="flex-start">
        <Heading as="h1" size="2xl">
          Page not found
        </Heading>
        <Text color="fg.muted">That link doesn't lead anywhere. It may have been mistyped or removed.</Text>
        <LinkButton asChild variant="outline">
          <RouterLink to="/">Back home</RouterLink>
        </LinkButton>
      </Stack>
    </Container>
  );
}

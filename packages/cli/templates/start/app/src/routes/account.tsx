import { Container, Heading, Stack, Text } from "@chakra-ui/react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { APP_NAME } from "#/site-config";

export const Route = createFileRoute("/account")({
  // A page only signed-in users see. Server functions it calls check again with `requireUser`.
  beforeLoad: ({ context, location }) => {
    if (!context.viewer.user) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { user: context.viewer.user };
  },
  head: () => ({
    meta: [{ title: `Your account · ${APP_NAME}` }, { name: "robots", content: "noindex" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = Route.useRouteContext();
  return (
    <Container maxW="2xl" py={{ base: 10, md: 16 }}>
      <Stack gap={6}>
        <Heading as="h1" size="2xl">
          Your account
        </Heading>
        <Stack gap={1}>
          <Text fontWeight="medium">{user.name}</Text>
          <Text color="fg.muted">{user.email}</Text>
        </Stack>
      </Stack>
    </Container>
  );
}

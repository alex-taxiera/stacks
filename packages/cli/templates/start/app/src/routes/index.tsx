import { Container, Heading, HStack, Icon, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "__UI_PKG__/card";
import { LinkButton } from "__UI_PKG__/link-button";
import type { IconType } from "react-icons";
import { LuDatabase, LuLock, LuServer } from "react-icons/lu";

import { RouterLink } from "#/components/router-link";
import { APP_NAME } from "#/site-config";

export const Route = createFileRoute("/")({
  component: Home,
});

const FEATURES: { icon: IconType; title: string; body: string }[] = [
  {
    icon: LuServer,
    title: "Rendered on the server",
    body: "Pages arrive as HTML with their data, then hydrate. Server functions do the rest.",
  },
  {
    icon: LuLock,
    title: "Accounts",
    body: "better-auth: a password checked by email, or a one-time code, with rate limits.",
  },
  {
    icon: LuDatabase,
    title: "Postgres",
    body: "Drizzle for queries and migrations you review and commit.",
  },
];

function Home() {
  const { viewer } = Route.useRouteContext();
  return (
    <>
      <Container maxW="6xl" pt={{ base: 12, md: 20 }} pb={{ base: 10, md: 16 }}>
        <Stack gap={6} align="center" textAlign="center" maxW="3xl" mx="auto">
          <Heading as="h1" size={{ base: "4xl", md: "6xl" }} letterSpacing="tight">
            {APP_NAME}
          </Heading>
          <Text fontSize={{ base: "lg", md: "xl" }} color="fg.muted">
            Replace this page with what the app is for.
          </Text>
          <HStack gap={3} wrap="wrap" justify="center">
            {viewer.user ? (
              <LinkButton asChild size="lg">
                <RouterLink to="/account">Your account</RouterLink>
              </LinkButton>
            ) : (
              <>
                <LinkButton asChild size="lg">
                  <RouterLink to="/signup">Create an account</RouterLink>
                </LinkButton>
                <LinkButton asChild size="lg" variant="outline">
                  <RouterLink to="/login">Sign in</RouterLink>
                </LinkButton>
              </>
            )}
          </HStack>
        </Stack>
      </Container>

      <Container maxW="6xl" pb={{ base: 14, md: 20 }}>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={6}>
          {FEATURES.map(({ icon, title, body }) => (
            <Card
              key={title}
              variant="subtle"
              icon={<Icon as={icon} boxSize={6} color="accent.fg" aria-hidden />}
              title={title}
              titleProps={{ as: "h2" }}
              description={body}
            />
          ))}
        </SimpleGrid>
      </Container>
    </>
  );
}

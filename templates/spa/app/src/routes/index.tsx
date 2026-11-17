import { Container, Heading, HStack, Icon, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "__UI_PKG__/card";
import { LinkButton } from "__UI_PKG__/link-button";
import type { IconType } from "react-icons";
import { LuLayers, LuPalette, LuZap } from "react-icons/lu";

import { RouterLink } from "#/components/router-link";
import { APP_NAME } from "#/site-config";

export const Route = createFileRoute("/")({
  component: Home,
});

const FEATURES: { icon: IconType; title: string; body: string }[] = [
  {
    icon: LuZap,
    title: "Prerendered",
    body: "Every page is rendered to static HTML at build time, so the first paint needs no JavaScript.",
  },
  {
    icon: LuPalette,
    title: "Chakra UI",
    body: "Components and the theme come from the shared UI package, so every app in the repo looks alike.",
  },
  {
    icon: LuLayers,
    title: "Stories as tests",
    body: "Every Storybook story runs as a browser test, with accessibility checks from axe.",
  },
];

function Home() {
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
            <LinkButton asChild size="lg">
              <RouterLink to="/about">Learn more</RouterLink>
            </LinkButton>
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

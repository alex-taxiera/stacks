import { Container, Heading, Stack, Text } from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";

import { APP_NAME } from "#/site-config";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({ meta: [{ title: `About · ${APP_NAME}` }] }),
});

function About() {
  return (
    <Container maxW="3xl" py={{ base: 12, md: 20 }}>
      <Stack gap={4}>
        <Heading as="h1" size="3xl">
          About
        </Heading>
        <Text color="fg.muted">
          A second page, so the prerender has a link to follow and the header has a page to mark
          as current.
        </Text>
      </Stack>
    </Container>
  );
}

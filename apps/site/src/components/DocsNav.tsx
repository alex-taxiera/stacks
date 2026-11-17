import { Box, Container, Heading, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";
import { LuArrowLeft, LuArrowRight } from "react-icons/lu";

import type { DocLink } from "#/docs";

export interface DocSummary extends DocLink {
  description: string;
}

/** The docs' sidebar: every page, in reading order, with the current one marked. */
export function DocsNav({ docs, currentHref }: { docs: readonly DocLink[]; currentHref: string }) {
  return (
    <IslandProvider>
      <Box as="nav" aria-label="Docs" position={{ md: "sticky" }} top={{ md: 20 }}>
        <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" mb={2}>
          Docs
        </Text>
        <Stack as="ul" gap={1} listStyle="none" fontSize="sm">
          {docs.map((doc) => (
            <li key={doc.href}>
              <Link
                href={doc.href}
                color="fg.muted"
                display="block"
                py={1}
                ps={3}
                borderStartWidth="2px"
                borderColor="transparent"
                _hover={{ color: "fg" }}
                _currentPage={{
                  color: "accent.fg",
                  fontWeight: "semibold",
                  borderColor: "accent.border",
                }}
                aria-current={doc.href === currentHref ? "page" : undefined}
              >
                {doc.title}
              </Link>
            </li>
          ))}
        </Stack>
      </Box>
    </IslandProvider>
  );
}

/** Every doc as a title and description, for the docs' index. */
export function DocList({ docs }: { docs: readonly DocSummary[] }) {
  return (
    <IslandProvider>
      <Container maxW="5xl">
        <Stack as="ol" gap={6} listStyle="none">
          {docs.map((doc) => (
            <Stack as="li" key={doc.href} gap={1}>
              <Heading as="h2" size="lg">
                <Link href={doc.href} color="fg">
                  {doc.title}
                </Link>
              </Heading>
              <Text color="fg.muted">{doc.description}</Text>
            </Stack>
          ))}
        </Stack>
      </Container>
    </IslandProvider>
  );
}

/** The links to the previous and next pages, at a doc's foot. */
export function DocPager({ previous, next }: { previous?: DocLink; next?: DocLink }) {
  return (
    <IslandProvider>
      <HStack
        as="nav"
        aria-label="Previous and next"
        justify="space-between"
        gap={4}
        mt={12}
        pt={6}
        borderTopWidth="1px"
      >
        {previous ? (
          <Link href={previous.href} color="fg.muted" _hover={{ color: "fg" }}>
            <LuArrowLeft aria-hidden />
            {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={next.href} color="fg.muted" _hover={{ color: "fg" }} textAlign="end">
            {next.title}
            <LuArrowRight aria-hidden />
          </Link>
        )}
      </HStack>
    </IslandProvider>
  );
}

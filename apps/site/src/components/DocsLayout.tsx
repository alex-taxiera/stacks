import { Box, Container, Grid, Heading, Stack, Text } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";
import type { ReactNode } from "react";

import type { DocLink } from "#/docs";

import { DocPager, DocsNav } from "./DocsNav";

interface DocsLayoutProps {
  title: string;
  description: string;
  /** Every doc, in reading order, for the sidebar. */
  docs: readonly DocLink[];
  currentHref: string;
  previous?: DocLink;
  next?: DocLink;
  /** The page's content: from an Astro page, its slot, already HTML. */
  children: ReactNode;
}

/**
 * A doc page: the sidebar beside the title, the content and the links to the pages either side.
 * Its children go in without containers of their own (`contained={false}`).
 */
export function DocsLayout({
  title,
  description,
  docs,
  currentHref,
  previous,
  next,
  children,
}: DocsLayoutProps) {
  return (
    <IslandProvider>
      <Container maxW="5xl" pt={{ base: 8, md: 12 }}>
        <Grid
          templateColumns={{ base: "1fr", md: "13rem minmax(0, 1fr)" }}
          gap={{ base: 8, md: 12 }}
        >
          <Box order={{ base: 1, md: 0 }}>
            <DocsNav docs={docs} currentHref={currentHref} />
          </Box>
          <Stack as="article" gap={8} minW={0}>
            <Stack gap={3}>
              <Heading as="h1" size={{ base: "3xl", md: "4xl" }}>
                {title}
              </Heading>
              <Text fontSize="lg" color="fg.muted">
                {description}
              </Text>
            </Stack>
            {children}
            <DocPager {...(previous ? { previous } : {})} {...(next ? { next } : {})} />
          </Stack>
        </Grid>
      </Container>
    </IslandProvider>
  );
}

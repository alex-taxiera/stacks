import { Container, Heading, Stack, Text } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";
import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  lead?: ReactNode;
  /** The section's body: from an Astro page, its slot, already HTML. */
  children?: ReactNode;
}

/** A titled part of a page, with an optional lead and whatever the page puts under it. */
export function Section({ title, lead, children }: SectionProps) {
  return (
    <IslandProvider>
      <Stack as="section" gap={6} py={{ base: 8, md: 12 }}>
        <Container maxW="5xl">
          <Stack gap={2}>
            <Heading as="h2" size="2xl">
              {title}
            </Heading>
            {lead && (
              <Text color="fg.muted" maxW="70ch">
                {lead}
              </Text>
            )}
          </Stack>
        </Container>
        {children}
      </Stack>
    </IslandProvider>
  );
}

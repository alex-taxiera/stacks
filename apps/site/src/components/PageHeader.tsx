import { Container, Heading, Stack, Text } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /** A line under the title. */
  lead?: ReactNode;
}

/** A page's title and lead, at the top of its `<main>`. */
export function PageHeader({ title, lead }: PageHeaderProps) {
  return (
    <IslandProvider>
      <Container maxW="5xl" pt={{ base: 10, md: 16 }} pb={8}>
        <Stack gap={3}>
          <Heading as="h1" size={{ base: "3xl", md: "4xl" }}>
            {title}
          </Heading>
          {lead && (
            <Text fontSize="lg" color="fg.muted">
              {lead}
            </Text>
          )}
        </Stack>
      </Container>
    </IslandProvider>
  );
}

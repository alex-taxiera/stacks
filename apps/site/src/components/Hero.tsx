import { Container, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";
import { LinkButton } from "@stacks/ui/link-button";
import type { ReactNode } from "react";

interface HeroProps {
  /** The page's own `<h1>`. */
  title: ReactNode;
  lead: ReactNode;
  /** Primary and secondary links. */
  actions: readonly { href: string; label: string }[];
  /** Under the lead, before the links: the install command, which the page hydrates itself. */
  children?: ReactNode;
}

/** The home page's opening: what stacks is, how to start, and where to go next. */
export function Hero({ title, lead, actions, children }: HeroProps) {
  return (
    <IslandProvider>
      <Container maxW="5xl" pt={{ base: 12, md: 24 }} pb={{ base: 10, md: 16 }}>
        <Stack gap={6} align="flex-start">
          <Heading
            as="h1"
            size={{ base: "4xl", md: "6xl" }}
            letterSpacing="tight"
            lineHeight="shorter"
            maxW="20ch"
          >
            {title}
          </Heading>
          <Text fontSize={{ base: "lg", md: "xl" }} color="fg.muted" maxW="60ch">
            {lead}
          </Text>
          {children}
          <HStack gap={3} wrap="wrap">
            {actions.map((action, index) => (
              <LinkButton
                key={action.href}
                href={action.href}
                size="lg"
                variant={index === 0 ? "solid" : "outline"}
              >
                {action.label}
              </LinkButton>
            ))}
          </HStack>
        </Stack>
      </Container>
    </IslandProvider>
  );
}

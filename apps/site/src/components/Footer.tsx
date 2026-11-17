import { Box, Container, Text } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";

import { APP_NAME } from "#/site-config";

/** The year the site was built: its pages are built, not rendered per visit. */
const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <IslandProvider>
      <Box as="footer" mt={16} borderTopWidth="1px" py={8}>
        <Container maxW="5xl">
          <Text fontSize="xs" color="fg.muted" textAlign="center">
            © {YEAR} {APP_NAME}
          </Text>
        </Container>
      </Box>
    </IslandProvider>
  );
}

import { Box, Container, Text } from "@chakra-ui/react";

import { APP_NAME } from "#/site-config";

/** Read once, when the server starts: a render must not depend on the clock. */
const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <Box as="footer" mt={16} borderTopWidth="1px" py={8}>
      <Container maxW="6xl">
        <Text fontSize="xs" color="fg.muted" textAlign="center">
          © {YEAR} {APP_NAME}
        </Text>
      </Container>
    </Box>
  );
}

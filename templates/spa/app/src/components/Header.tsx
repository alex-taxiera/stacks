import { Box, Container, HStack } from "@chakra-ui/react";
import { ColorModeButton } from "__UI_PKG__/color-mode";

import { RouterLink } from "#/components/router-link";
import { APP_NAME } from "#/site-config";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
] as const;

export function Header() {
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex="sticky"
      borderBottomWidth="1px"
      bg="bg/80"
      backdropFilter="blur(12px)"
    >
      <Container maxW="6xl" py={3}>
        <HStack justify="space-between" gap={4}>
          <RouterLink to="/" fontWeight="semibold" color="fg" textDecoration="none">
            {APP_NAME}
          </RouterLink>

          <HStack as="nav" aria-label="Main" gap={{ base: 3, sm: 5 }} fontSize="sm">
            {NAV.map(({ to, label }) => (
              <RouterLink
                key={to}
                to={to}
                color="fg.muted"
                _hover={{ color: "fg" }}
                _currentPage={{ fontWeight: "semibold", color: "fg" }}
                activeOptions={{ exact: true }}
                activeProps={{ "aria-current": "page" }}
              >
                {label}
              </RouterLink>
            ))}
            <ColorModeButton />
          </HStack>
        </HStack>
      </Container>
    </Box>
  );
}

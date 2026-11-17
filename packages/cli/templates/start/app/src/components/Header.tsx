import { Box, Button, Container, HStack } from "@chakra-ui/react";
import { ColorModeButton } from "__UI_PKG__/color-mode";
import { LinkButton } from "__UI_PKG__/link-button";

import { RouterLink } from "#/components/router-link";
import type { Viewer } from "#/lib/viewer";
import { APP_NAME } from "#/site-config";

export interface HeaderProps {
  viewer: Viewer;
  onSignOut: () => Promise<void>;
}

export function Header({ viewer, onSignOut }: HeaderProps) {
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

          <HStack as="nav" aria-label="Main" gap={{ base: 2, sm: 3 }} fontSize="sm">
            {viewer.user ? (
              <>
                <RouterLink
                  to="/account"
                  color="fg.muted"
                  _hover={{ color: "fg" }}
                  _currentPage={{ fontWeight: "semibold", color: "fg" }}
                  activeProps={{ "aria-current": "page" }}
                >
                  {viewer.user.name}
                </RouterLink>
                <Button size="sm" variant="ghost" onClick={onSignOut}>
                  Sign out
                </Button>
              </>
            ) : (
              <LinkButton asChild size="sm" variant="outline">
                <RouterLink to="/login">Sign in</RouterLink>
              </LinkButton>
            )}
            <ColorModeButton />
          </HStack>
        </HStack>
      </Container>
    </Box>
  );
}

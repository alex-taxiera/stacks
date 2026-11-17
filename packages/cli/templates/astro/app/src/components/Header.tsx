import { Box, Container, HStack, Link } from "@chakra-ui/react";
import { ColorModeButton } from "__UI_PKG__/color-mode";
import { IslandProvider } from "__UI_PKG__/island";

import { APP_NAME, NAV } from "#/site-config";

interface HeaderProps {
  /** The page's path (`Astro.url.pathname`), which marks its link as the current page. */
  currentPath: string;
}

/** Whether `href` is the current page, or a section the current page is in. */
function isCurrent(href: string, currentPath: string) {
  return href === "/" ? currentPath === "/" : currentPath.startsWith(href);
}

/** The site's header. The layout hydrates it (`client:load`) for the color-mode button. */
export function Header({ currentPath }: HeaderProps) {
  return (
    <IslandProvider>
      <Box
        as="header"
        position="sticky"
        top={0}
        zIndex="sticky"
        borderBottomWidth="1px"
        bg="bg/80"
        backdropFilter="blur(12px)"
      >
        <Container maxW="4xl" py={3}>
          <HStack justify="space-between" gap={4}>
            <Link href="/" fontWeight="semibold" color="fg" textDecoration="none">
              {APP_NAME}
            </Link>
            <HStack as="nav" aria-label="Main" gap={{ base: 3, sm: 5 }} fontSize="sm">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  color="fg.muted"
                  _hover={{ color: "fg" }}
                  _currentPage={{ fontWeight: "semibold", color: "fg" }}
                  aria-current={isCurrent(href, currentPath) ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
              <ColorModeButton />
            </HStack>
          </HStack>
        </Container>
      </Box>
    </IslandProvider>
  );
}

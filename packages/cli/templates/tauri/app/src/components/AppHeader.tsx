import { Heading, HStack } from "@chakra-ui/react";
import { ColorModeButton } from "__UI_PKG__/color-mode";
import type { ReactNode } from "react";
// stacks:slot imports

/** Controls at the end of the header, before the color mode's. */
const HEADER_ACTIONS: ReactNode[] = [
  // stacks:slot header-actions
];

/** The app's header: its name, then its buttons. */
export function AppHeader() {
  // stacks:slot header-setup
  return (
    <HStack
      as="header"
      gap="0"
      align="stretch"
      bg="bg.subtle"
      borderBottomWidth="1px"
      // stacks:slot header-props
    >
      <Heading as="h1" size="md" flex="1" display="flex" alignItems="center" px="4" py="2">
        __APP_TITLE__
      </Heading>
      <HStack gap="2" pe="4">
        {HEADER_ACTIONS}
        <ColorModeButton />
      </HStack>
      {/* What follows the buttons, at the header's very end. */}
      {[
        // stacks:slot header-end
      ]}
    </HStack>
  );
}

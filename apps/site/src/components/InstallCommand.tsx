import { Box, Code, HStack, IconButton, useClipboard } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";
import { LuCheck, LuCopy } from "react-icons/lu";

interface InstallCommandProps {
  command: string;
}

/** A shell command with a button that copies it. A page hydrates it (`client:load`). */
export function InstallCommand({ command }: InstallCommandProps) {
  const clipboard = useClipboard({ value: command, timeout: 2000 });
  return (
    <IslandProvider>
      <HStack
        gap={2}
        ps={4}
        pe={1}
        py={1}
        borderWidth="1px"
        rounded="lg"
        bg="bg.subtle"
        maxW="full"
        w="fit-content"
      >
        <Code
          fontSize={{ base: "sm", md: "md" }}
          bg="transparent"
          px={0}
          overflowX="auto"
          css={{ scrollbarWidth: "none" }}
          whiteSpace="nowrap"
        >
          <Box as="span" aria-hidden="true" color="fg.muted" userSelect="none" me="2">
            $
          </Box>
          {command}
        </Code>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={clipboard.copied ? "Copied" : "Copy the command"}
          onClick={() => clipboard.copy()}
        >
          {clipboard.copied ? <LuCheck /> : <LuCopy />}
        </IconButton>
      </HStack>
    </IslandProvider>
  );
}

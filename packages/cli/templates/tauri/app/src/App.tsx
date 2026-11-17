import { Button, Container, Heading, HStack, Input, Link, Stack, Text } from "@chakra-ui/react";
import { ColorModeButton } from "__UI_PKG__/color-mode";
import { Field } from "__UI_PKG__/field";
import { type FormEvent, type ReactNode, useState } from "react";

import { api } from "#/api";
// stacks:slot imports

const TAURI_DOCS = "https://v2.tauri.app/";

/** Controls at the end of the header, before the color mode's. */
const HEADER_ACTIONS: ReactNode[] = [
  // stacks:slot header-actions
];

export function App() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string>();
  const [file, setFile] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  /** Runs `work`, showing what went wrong if it fails. */
  const attempt = async (work: () => Promise<void>) => {
    setError(undefined);
    try {
      await work();
    } catch (cause) {
      setError(String(cause));
    }
  };

  const greet = (event: FormEvent) => {
    event.preventDefault();
    void attempt(async () => setMessage((await api.greet(name)).message));
  };

  return (
    <Container maxW="xl" py={12}>
      <Stack gap={8}>
        <HStack justify="space-between">
          <Heading as="h1" size="2xl">
            __APP_TITLE__
          </Heading>
          <HStack gap={2}>
            {HEADER_ACTIONS}
            <ColorModeButton />
          </HStack>
        </HStack>

        <Stack as="form" gap={4} onSubmit={greet}>
          <Field label="Your name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Button type="submit" alignSelf="start">
            Greet me
          </Button>
        </Stack>
        {message && <Text fontSize="lg">{message}</Text>}

        <Stack gap={2} align="start">
          <Button
            variant="outline"
            onClick={() => void attempt(async () => setFile(await api.chooseFile()))}
          >
            Choose a file
          </Button>
          {file && <Text wordBreak="break-all">You chose {file}</Text>}
        </Stack>

        {error && <Text color="fg.error">{error}</Text>}

        <Text color="fg.muted" fontSize="sm">
          The greeting comes from Rust: <code>crates/core</code>, through a Tauri command.{" "}
          <Link
            href={TAURI_DOCS}
            onClick={(event) => {
              event.preventDefault();
              void api.openInBrowser(TAURI_DOCS);
            }}
          >
            Tauri's docs
          </Link>
        </Text>
      </Stack>
    </Container>
  );
}

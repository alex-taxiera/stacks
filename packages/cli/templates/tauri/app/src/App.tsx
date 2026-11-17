import { Button, Container, Heading, HStack, Input, Link, Stack, Text } from "@chakra-ui/react";
import { ColorModeButton } from "__UI_PKG__/color-mode";
import { Field } from "__UI_PKG__/field";
import { type FormEvent, useState } from "react";

import { api } from "#/api";

const TAURI_DOCS = "https://v2.tauri.app/";

export function App() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const greet = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    try {
      setMessage((await api.greet(name)).message);
    } catch (cause) {
      setError(String(cause));
    }
  };

  return (
    <Container maxW="xl" py={12}>
      <Stack gap={8}>
        <HStack justify="space-between">
          <Heading as="h1" size="2xl">
            __APP_TITLE__
          </Heading>
          <ColorModeButton />
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

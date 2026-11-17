import { Box, Button, Container, Grid, Input, Link, Stack, Text } from "@chakra-ui/react";
import { Field } from "__UI_PKG__/field";
import { showError } from "__UI_PKG__/notify";
import { type FormEvent, useState } from "react";

import { api } from "#/api";
import { AppHeader } from "#/components/AppHeader";

const TAURI_DOCS = "https://v2.tauri.app/";

/** Runs `work`, and says what went wrong in a toast if it fails. */
async function attempt(title: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    showError(title, error);
  }
}

export function App() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string>();
  const [file, setFile] = useState<string | null>(null);

  const greet = (event: FormEvent) => {
    event.preventDefault();
    void attempt("Couldn't greet you", async () => setMessage((await api.greet(name)).message));
  };

  return (
    // The header stays put; the rest scrolls under it.
    <Grid templateRows="auto 1fr" h="100dvh">
      <AppHeader />
      <Box as="main" overflowY="auto" minH="0">
        <Container maxW="xl" py={12}>
          <Stack gap={8}>
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
                onClick={() =>
                  void attempt("Couldn't open the file picker", async () =>
                    setFile(await api.chooseFile()),
                  )
                }
              >
                Choose a file
              </Button>
              {file && <Text wordBreak="break-all">You chose {file}</Text>}
            </Stack>

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
      </Box>
    </Grid>
  );
}

import { Badge, Code, Container, HStack, Stack, Table, Text } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";

import type { AddonRow, StackRow } from "#/stacks-data";

/** Ids as code, in a row that wraps. */
function Ids({ ids, empty = "—" }: { ids: readonly string[]; empty?: string }) {
  if (ids.length === 0) return <Text color="fg.muted">{empty}</Text>;
  return (
    <HStack gap={1} wrap="wrap">
      {ids.map((id) => (
        <Code key={id} size="sm">
          {id}
        </Code>
      ))}
    </HStack>
  );
}

interface TableProps {
  /** In a page-width container of its own; false inside a layout that has one. */
  contained?: boolean;
}

/** Wraps a table so a narrow screen scrolls it rather than the page. */
function Scroll({ contained = true, children }: TableProps & { children: React.ReactNode }) {
  const table = (
    <Table.ScrollArea borderWidth="1px" rounded="md">
      {children}
    </Table.ScrollArea>
  );
  return contained ? <Container maxW="5xl">{table}</Container> : table;
}

/** Every stack, with what it is, where it lands, its deploy targets and its add-ons. */
export function StackTable({ stacks, contained }: TableProps & { stacks: readonly StackRow[] }) {
  return (
    <IslandProvider>
      <Scroll contained={contained}>
        <Table.Root size="sm" variant="line" minW="3xl" css={{ "& td": { whiteSpace: "normal" } }}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Stack</Table.ColumnHeader>
              <Table.ColumnHeader>What</Table.ColumnHeader>
              <Table.ColumnHeader minW="15rem">
                <Code size="sm">--deploy</Code>
              </Table.ColumnHeader>
              <Table.ColumnHeader>
                <Code size="sm">--with</Code>
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {stacks.map((stack) => (
              <Table.Row key={stack.id} verticalAlign="top">
                <Table.Cell>
                  <Stack gap={1} align="flex-start">
                    <Code size="md" fontWeight="semibold">
                      {stack.id}
                    </Code>
                    <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                      {stack.dir}
                    </Text>
                  </Stack>
                </Table.Cell>
                <Table.Cell>{stack.summary}</Table.Cell>
                <Table.Cell>
                  <Stack gap={2}>
                    {stack.deploys.map((deploy) => (
                      <Stack key={deploy.id} gap={0.5}>
                        <HStack gap={1}>
                          <Code size="sm">{deploy.id}</Code>
                          {deploy.isDefault && (
                            <Badge size="xs" variant="subtle">
                              default
                            </Badge>
                          )}
                        </HStack>
                        <Text fontSize="xs" color="fg.muted">
                          {deploy.summary}
                        </Text>
                      </Stack>
                    ))}
                  </Stack>
                </Table.Cell>
                <Table.Cell>
                  <Ids ids={stack.addons} />
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Scroll>
    </IslandProvider>
  );
}

/** Every add-on once, with the stacks that take it and anything else it needs. */
export function AddonTable({ addons, contained }: TableProps & { addons: readonly AddonRow[] }) {
  return (
    <IslandProvider>
      <Scroll contained={contained}>
        <Table.Root size="sm" variant="line" minW="2xl" css={{ "& td": { whiteSpace: "normal" } }}>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Add-on</Table.ColumnHeader>
              <Table.ColumnHeader>What</Table.ColumnHeader>
              <Table.ColumnHeader>Stacks</Table.ColumnHeader>
              <Table.ColumnHeader>Needs</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {addons.map((addon) => (
              <Table.Row key={addon.id} verticalAlign="top">
                <Table.Cell>
                  <Code size="md" fontWeight="semibold">
                    {addon.id}
                  </Code>
                </Table.Cell>
                <Table.Cell>{addon.summary}</Table.Cell>
                <Table.Cell>
                  <Ids ids={addon.stacks} />
                </Table.Cell>
                <Table.Cell>
                  <Stack gap={1} fontSize="xs">
                    {addon.deploys.length > 0 && (
                      <Text>
                        <Code size="sm">--deploy {addon.deploys.join(" | ")}</Code>
                      </Text>
                    )}
                    {addon.needsStack && (
                      <Text>
                        a <Code size="sm">{addon.needsStack}</Code> app in the repo
                      </Text>
                    )}
                    {addon.deploys.length === 0 && !addon.needsStack && (
                      <Text color="fg.muted">—</Text>
                    )}
                  </Stack>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Scroll>
    </IslandProvider>
  );
}

import { Container, Heading, Icon, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";
import type { IconType } from "react-icons";
import { LuBot, LuCloudUpload, LuPackageCheck, LuWrench } from "react-icons/lu";

interface Feature {
  icon: IconType;
  title: string;
  body: string;
}

const FEATURES: readonly Feature[] = [
  {
    icon: LuWrench,
    title: "Tooling, already wired",
    body: "oxlint and oxfmt, Storybook stories that run as Vitest browser tests, husky and lint-staged, CI and grouped Dependabot updates. pnpm is required, and every repo is a workspace.",
  },
  {
    icon: LuBot,
    title: "Set up for agents",
    body: "One AGENTS.md and an .agents/ folder that sync to Claude Code, Cursor and VS Code, with MCP servers for Chakra and every Storybook. TanStack Intent loads the skills your packages ship.",
  },
  {
    icon: LuPackageCheck,
    title: "Known-good versions",
    body: "Templates never name a version. A nightly canary scaffolds, lints, typechecks, tests and builds every stack against the newest releases, and only versions that pass reach the snapshot.",
  },
  {
    icon: LuCloudUpload,
    title: "Deploys included",
    body: "Path-filtered workflows for Cloudflare Workers, GitHub Pages, Docker Compose, npm with provenance and GitHub Releases, with a preview of every pull request on Cloudflare.",
  },
];

/** What every repo stacks makes comes with. */
export function Features() {
  return (
    <IslandProvider>
      <Container maxW="5xl" py={{ base: 10, md: 16 }}>
        <Stack gap={8}>
          <Heading as="h2" size="2xl">
            What every repo starts with
          </Heading>
          <SimpleGrid
            as="ul"
            columns={{ base: 1, md: 2 }}
            gap={{ base: 8, md: 10 }}
            listStyle="none"
          >
            {FEATURES.map((feature) => (
              <Stack as="li" key={feature.title} gap={2}>
                <Icon as={feature.icon} boxSize={6} color="accent.fg" aria-hidden />
                <Heading as="h3" size="lg">
                  {feature.title}
                </Heading>
                <Text color="fg.muted">{feature.body}</Text>
              </Stack>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </IslandProvider>
  );
}

import type { Layer } from "../model.ts";
import { CHAKRA, REACT, REACT_TYPES, STORYBOOK, storybookScripts, TYPESCRIPT } from "./shared.ts";

/** Chakra components that have (or could have) a snippet, which apps must import from the UI package. */
const SNIPPET_COMPONENTS = [
  "Accordion",
  "ActionBar",
  "Alert",
  "Avatar",
  "Blockquote",
  "Breadcrumb",
  "Card",
  "Carousel",
  "Checkbox",
  "CheckboxCard",
  "Clipboard",
  "CloseButton",
  "ColorPicker",
  "Combobox",
  "DataList",
  "Dialog",
  "Drawer",
  "EmptyState",
  "Field",
  "FileUpload",
  "HoverCard",
  "Menu",
  "NativeSelect",
  "NumberInput",
  "Pagination",
  "PinInput",
  "Popover",
  "Progress",
  "ProgressCircle",
  "QrCode",
  "RadioCard",
  "RadioGroup",
  "RatingGroup",
  "ScrollArea",
  "SegmentGroup",
  "Select",
  "Skeleton",
  "Slider",
  "Splitter",
  "Status",
  "Steps",
  "Switch",
  "Tag",
  "TagsInput",
  "Timeline",
  "Toaster",
  "Toggle",
  "Tooltip",
];

/**
 * `packages/ui`: the Chakra snippets, theme, provider and shared Storybook preview, and everything
 * at the root that only matters once a repo has UI. The first app that needs it applies it.
 */
export const ui: Layer = (ctx) => {
  if (!ctx.ui) throw new Error("the ui layer was applied without a UI package");
  const pkg = ctx.ui.package;
  const port = ctx.ui.storybookPort;
  return {
    id: "ui",
    packages: {
      ui: {
        dependencies: ["@fontsource-variable/inter"],
        devDependencies: [
          ...CHAKRA,
          ...REACT,
          ...REACT_TYPES,
          ...STORYBOOK,
          ...TYPESCRIPT,
          "@chakra-ui/cli",
          "@vitejs/plugin-react",
          "vite",
        ],
        peerDependencies: [...CHAKRA, ...REACT],
        scripts: {
          typegen: "chakra typegen src/theme.ts",
          typecheck: "pnpm run typegen && tsc --noEmit",
          // CI runs `pnpm -r --if-present run test:setup --with-deps` before the tests.
          "test:setup": "playwright install chromium",
          test: "pnpm run typegen && vitest run",
          ...storybookScripts(port),
        },
        fields: {
          exports: {
            "./theme": "./src/theme.ts",
            "./storybook": "./src/storybook.tsx",
            "./*": "./src/components/ui/*.tsx",
          },
        },
      },
      root: {
        scripts: {
          storybook: "pnpm -r --parallel --no-bail --if-present storybook",
          "ci-storybook": "pnpm -r --parallel --no-bail --if-present ci-storybook",
        },
      },
    },
    json: {
      ".oxlintrc.json": {
        rules: {
          "no-restricted-imports": [
            "error",
            {
              paths: [
                {
                  name: "@chakra-ui/react",
                  importNames: SNIPPET_COMPONENTS,
                  message: `Use the snippet from ${pkg} instead (e.g. ${pkg}/tooltip for Tooltip). If it is missing, add it with \`pnpm --filter ${pkg} exec chakra snippet add <name> --tsx --outdir src/components/ui\`.`,
                },
              ],
            },
          ],
        },
        overrides: [
          {
            files: ["packages/ui/src/components/ui/**"],
            rules: {
              "eslint/no-shadow": "off",
              "jsx-a11y/prefer-tag-over-role": "off",
              "react/exhaustive-effect-dependencies": "off",
              "react/immutability": "off",
              "react/set-state-in-effect": "off",
              "react-hooks/exhaustive-deps": "off",
              "no-restricted-imports": "off",
            },
          },
          {
            files: ["packages/ui/src/**", "**/.storybook/**", "apps/*/src/components/ui/**"],
            rules: { "no-restricted-imports": "off" },
          },
        ],
      },
      ".vscode/tasks.json": {
        version: "2.0.0",
        tasks: [
          {
            label: "Start Storybook",
            detail: "Every package's Storybook, so their MCP servers are up for agents.",
            type: "shell",
            command: "pnpm run ci-storybook",
            isBackground: true,
            problemMatcher: [],
            runOptions: { runOn: "folderOpen" },
            presentation: { reveal: "always", panel: "new" },
          },
        ],
      },
    },
    lines: {
      ".gitignore": [
        "*storybook.log",
        "storybook-static",
        "__screenshots__/",
        ".vitest-attachments/",
      ],
    },
    mcp: {
      // pnpm dlx, not npx: the root's devEngines makes npm and npx refuse to run in the repo.
      "chakra-ui": { command: "pnpm", args: ["dlx", "@chakra-ui/react-mcp"] },
      "storybook-ui": { type: "http", url: `http://localhost:${port}/mcp` },
    },
    agents: [
      {
        region: "apps",
        id: "ui",
        body: [
          `- \`packages/ui\` (\`${pkg}\`) — the Chakra UI v3 snippets, theme, provider and shared Storybook`,
          `  preview every app uses. Source only, no build step: import \`${pkg}/<snippet>\`,`,
          `  \`${pkg}/theme\`, \`${pkg}/storybook\`. Storybook on ${port}; \`pnpm storybook\` starts every`,
          "  package's (VS Code does when the folder opens).",
        ].join("\n"),
      },
      { region: "ui", id: "ui", body: uiGuide(pkg) },
      {
        region: "mcp",
        id: "chakra-ui",
        body: "- `chakra-ui` — Chakra's component docs, props and examples.",
      },
      {
        region: "mcp",
        id: "storybook-ui",
        body: `- \`storybook-ui\` — \`packages/ui\`'s Storybook, port ${port}. Each app's Storybook is \`storybook-<app>\`, and is only up while it runs.`,
      },
    ],
    post: [
      {
        title: "Adding the Chakra UI agent skills",
        command: "pnpm",
        args: [
          "dlx",
          "skills",
          "add",
          "chakra-ui/chakra-ui",
          "--skill",
          "chakra-ui-builder",
          "--skill",
          "chakra-ui-refactor",
          "--skill",
          "chakra-ui-migrate",
          "--agent",
          "universal",
          "--copy",
          "--yes",
        ],
        needsInstall: true,
        optional: true,
        // It clones Chakra's repository, which can stall on a slow network.
        timeoutMs: 120_000,
      },
      {
        title: "Syncing agent config",
        command: "pnpm",
        args: ["run", "agents:sync"],
        needsInstall: true,
      },
      {
        title: "Generating Chakra theme types",
        command: "pnpm",
        args: ["--filter", pkg, "typegen"],
        needsInstall: true,
      },
    ],
  };
};

/** AGENTS.md's UI sections: Chakra, Storybook stories, the Storybook MCP and accessibility. */
function uiGuide(pkg: string): string {
  return `## UI

- **Chakra UI v3**, not v2: compound components (\`Dialog.Root\`, \`Switch.Root\`…) and
  \`colorPalette\`. Check an unfamiliar component's API with the \`chakra-ui\` MCP server before using
  it, and load the \`chakra-ui-builder\` skill (or \`chakra-ui-refactor\`) for UI work.
- **Reach for a snippet before a compound component.** \`packages/ui/src/components/ui\` holds
  Chakra's snippets, shared by every app, so a component writes \`<Switch checked>Label</Switch>\`,
  not the five parts behind it. oxlint enforces it: importing a component that has a snippet (or
  could have one) from \`@chakra-ui/react\` is an error outside \`packages/ui/src\` and \`.storybook\`.
  Before writing UI, check what's there with the \`storybook-ui\` MCP's \`docs-list\`. Add a missing
  snippet with \`pnpm --filter ${pkg} exec chakra snippet add <name> --tsx --outdir src/components/ui\`,
  convert it to React 19 style (\`ref\` as a prop, no \`forwardRef\`, no \`"use client"\`), import within
  the package by relative path, and give it a story so \`docs-show\` documents it.
- **Theme tokens, recipes and slot recipes live in \`packages/ui/src/theme.ts\`** and
  \`packages/ui/src/recipes\`, one system for every app. Run \`pnpm --filter ${pkg} typegen\` after
  changing them so their props are typed. Use semantic tokens (\`fg.muted\`, \`bg.subtle\`,
  \`accent.fg\`…) over raw colours so both colour modes work.

### Storybook and its MCP servers

Stories sit next to their component (\`Header.tsx\` and \`Header.stories.tsx\`) and every one runs as a
test under \`pnpm test\`. Each package has its own Storybook; the app Storybooks compose the library's
as a "UI library" ref. Shared preview setup (theme switcher, Chakra provider, toaster, a11y
settings) is \`${pkg}/storybook\`; each package's \`.storybook/preview.tsx\` spreads \`basePreview\` and
calls \`resetUi()\` in its \`beforeEach\`.

- Use the \`storybook-<package>\` MCP tools before answering questions about or changing UI
  components. Never guess props: call \`docs-list\` and \`docs-show\`, and use only props that are
  documented or shown in example stories. If a prop isn't documented, ask instead of assuming.
- Call \`get-storybook-story-instructions\` before creating or updating stories, and run \`test-run\`
  to verify your changes.
- Write or update a story when you create a reusable component or a snippet, or add props, states
  or variants to one. Cover each state the component can reach (empty, loading, error…), not every
  prop combination. Don't write stories for pages or thin wrappers.
- Add a \`play\` function that checks the behaviour a story is about, with role- or label-based
  queries. Chakra overlays (dialogs, tooltips, toasts) render in a portal: query them with
  \`screen\`, not \`canvas\`, and \`waitFor\` them to finish animating in.
- Don't wrap stories in a provider or add a \`<Toaster />\`; \`.storybook/preview.tsx\` does. Don't add
  \`tags: ["autodocs"]\` or a \`title\`; titles come from the file path.
- Prefer presentational components that take callbacks (\`onSave\`) so stories pass \`fn()\` args.

### Accessibility

Storybook's a11y addon runs axe on every story. Violations are reported in the a11y panel and by
the MCP's \`test-run\`, but don't fail tests (\`a11y.test: "todo"\` in \`${pkg}/storybook\`).

- Fix structural issues yourself: labels, roles, \`aria-label\` on icon-only buttons, alt text,
  table headers, heading order.
- Ask before changing anything visual, such as colour contrast, sizes or focus styles: describe
  the issue and offer two or three options.
- Don't turn rules off to make a report go away.`;
}

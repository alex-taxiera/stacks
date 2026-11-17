# AGENTS.md

Guide for coding agents working in this repo. Read [README.md](README.md) for what it is.

Sections between `<!-- stacks:… -->` markers are managed by [stacks](https://github.com/alex-taxiera/stacks):
`stacks add` and `stacks update` rewrite them. Edit outside the markers freely.

## Shape

A pnpm workspace. Every app lives in `apps/<name>` and builds on one shared UI package.

- `packages/ui` (`__UI_PKG__`) — the Chakra UI v3 snippets, theme, provider and shared Storybook
  preview every app uses. Source only, no build step: import `__UI_PKG__/<snippet>`,
  `__UI_PKG__/theme`, `__UI_PKG__/storybook`.

<!-- stacks:apps:start -->
<!-- stacks:apps:end -->

## Commands

| Task             | Command                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| Install          | `pnpm install` (also runs `agents:sync`; `corepack enable` once for pnpm)   |
| Storybooks       | `pnpm storybook` (every package's; VS Code starts them when the folder opens) |
| Tests            | `pnpm test` (unit tests, and every package's stories in headless Chromium)  |
| Typecheck, build | `pnpm typecheck` / `pnpm build`                                             |
| Lint, format     | `pnpm lint` / `pnpm format` (oxlint and oxfmt, from the root)               |
| Chakra types     | `pnpm --filter __UI_PKG__ typegen` (every app's dev, build and typecheck do) |
| Add an app       | `pnpm dlx @alex-taxiera/stacks add <stack> <name>`                          |

Run one package's script with `pnpm --filter <name> <script>`. Shared dependency versions live in
the `catalog:` in `pnpm-workspace.yaml`; a package asks for one with `"catalog:"`, so every package
gets the same React, Chakra and Vite.

## Rules

- **pnpm only.** Never run `npm`, `npx` or `yarn`: use `pnpm`, `pnpm exec` and `pnpm dlx`. The root
  `package.json` refuses other package managers (`devEngines`, `packageManager`).
- **Chakra UI v3**, not v2: compound components (`Dialog.Root`, `Switch.Root`…) and
  `colorPalette`. Check an unfamiliar component's API with the `chakra-ui` MCP server before using
  it, and load the `chakra-ui-builder` skill (or `chakra-ui-refactor`) for UI work.
- **Reach for a snippet before a compound component.** `packages/ui/src/components/ui` holds
  Chakra's snippets, shared by every app, so a component writes `<Switch checked>Label</Switch>`,
  not the five parts behind it. oxlint enforces it: importing a component that has a snippet (or
  could have one) from `@chakra-ui/react` is an error outside `packages/ui/src` and `.storybook`.
  Before writing UI, check what's there with the `storybook-ui` MCP's `docs-list`. Add a missing
  snippet with
  `pnpm --filter __UI_PKG__ exec chakra snippet add <name> --tsx --outdir src/components/ui`,
  convert it to React 19 style (`ref` as a prop, no `forwardRef`, no `"use client"`), import within
  the package by relative path, and give it a story so `docs-show` documents it.
- **Theme tokens, recipes and slot recipes live in `packages/ui/src/theme.ts`** and
  `packages/ui/src/recipes`, one system for every app. Run `pnpm --filter __UI_PKG__ typegen` after
  changing them so their props are typed. Use semantic tokens (`fg.muted`, `bg.subtle`, `accent.fg`…)
  over raw colours so both colour modes work.
- **Imports inside an app use `#/`** (`#/components/Header`), from its `tsconfig.json` `paths`.
- **Types over casts** in TypeScript: narrow with a guard instead of `as`.

<!-- stacks:rules:start -->
<!-- stacks:rules:end -->

## Agent config and MCP servers

`AGENTS.md`, `.agents/skills/` and `.agents/mcp.json` are the sources. `pnpm agents:sync` (run on
install, checkout and merge) generates `CLAUDE.md`, `.claude/skills/`, and the MCP configs for
Claude Code (`.mcp.json`), Cursor (`.cursor/mcp.json`) and VS Code (`.vscode/mcp.json`). Those
are gitignored: edit the sources, never the generated files. The Chakra skills come from
`pnpm dlx skills add chakra-ui/chakra-ui` and are pinned in `skills-lock.json`.

- `chakra-ui` — Chakra's component docs, props and examples.
- `storybook-<package>` — served by `@storybook/addon-mcp` at `http://localhost:<port>/mcp`, so only
  while that package's Storybook is running. Use the one for the package you're changing, and
  `storybook-ui` for the snippets.

<!-- stacks:mcp:start -->
<!-- stacks:mcp:end -->

When working on UI components:

- Use the `storybook` MCP tools before answering questions about or changing UI components.
- Never guess component props. Call `docs-list` to see documented components and `docs-show` for a
  component's props, and use only props that are documented or shown in example stories. Story
  names don't always match prop names. If a prop isn't documented, ask the user instead of
  assuming.
- Call `get-storybook-story-instructions` before creating or updating stories.
- Run `test-run` to verify your changes.

## Storybook stories

Stories sit next to their component (`Header.tsx` and `Header.stories.tsx`) and every one runs as a
test under `pnpm test`. Each package has its own Storybook; the app Storybooks compose the
library's as a "UI library" ref, so they show its stories too while it runs. Shared preview setup
(theme switcher, Chakra provider, toaster, a11y settings) is `__UI_PKG__/storybook`; each package's
`.storybook/preview.tsx` spreads `basePreview` and calls `resetUi()` in its `beforeEach`.

- Write or update a story when you create a reusable component or a snippet, or add props, states
  or variants to one. Cover each state the component can reach (empty, loading, error…), not every
  prop combination. Don't write stories for pages or thin wrappers.
- Add a `play` function that checks the behaviour a story is about, with role- or label-based
  queries. Chakra overlays (dialogs, tooltips, toasts) render in a portal: query them with
  `screen`, not `canvas`, and `waitFor` them to finish animating in.
- Don't wrap stories in a provider or add a `<Toaster />`; `.storybook/preview.tsx` does. Don't add
  `tags: ["autodocs"]` or a `title`; titles come from the file path.
- Prefer presentational components that take callbacks (`onSave`) so stories pass `fn()` args.

## Accessibility

Storybook's a11y addon runs axe on every story. Violations are reported in the a11y panel and by
the MCP's `test-run`, but don't fail tests (`a11y.test: "todo"` in `__UI_PKG__/storybook`).

- Fix structural issues yourself: labels, roles, `aria-label` on icon-only buttons, alt text,
  table headers, heading order.
- Ask before changing anything visual, such as colour contrast, sizes or focus styles: describe
  the issue and offer two or three options.
- Don't turn rules off to make a report go away.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
`<type>(<scope>): <description>`, for example `feat(web): add sign-in page` or
`chore(deps): bump vite`. Types: `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`,
`build`, `ci`, `chore`. Scope by app or package. Imperative, lower case, no trailing period; mark
breaking changes with `!` and a `BREAKING CHANGE:` footer. The default branch is `trunk`.

The pre-commit hook runs lint-staged (oxlint `--fix` and oxfmt on staged files). Don't skip it with
`--no-verify`; fix what it reports.

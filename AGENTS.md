# AGENTS.md

Guide for coding agents working in this repo. Read [README.md](README.md) for what it is.

Sections between `<!-- stacks:… -->` markers are managed by [stacks](https://github.com/alex-taxiera/stacks):
`stacks add` and `stacks update` rewrite them. Edit outside the markers freely.

<!-- intent-skills:start -->

## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:

- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.

<!-- intent-skills:end -->

## Shape

A pnpm workspace. Apps that deploy live in `apps/<name>`; packages that publish, and the shared UI
package, live in `packages/<name>`.

<!-- stacks:apps:start -->
<!-- stacks:block:app:cli -->

- `packages/cli` (`@alex-taxiera/stacks`, the `stacks` command) — stacks: a command-line tool,
  published to npm. TypeScript that Node 24 runs directly, built with `tsc` for publishing.
  - `pnpm --filter @alex-taxiera/stacks dev -- --help` runs it from source; `build`, `test`, `skills:check`.
  - It ships an agent skill, `packages/cli/skills/stacks/SKILL.md`, which Intent serves as
    `@alex-taxiera/stacks#stacks` to anyone who installs it, this repo included.

<!-- /stacks:block:app:cli -->
<!-- stacks:block:ui -->

- `packages/ui` (`@stacks/ui`) — the Chakra UI v3 snippets, theme, provider and shared Storybook
  preview every app uses. Source only, no build step: import `@stacks/ui/<snippet>`,
  `@stacks/ui/theme`, `@stacks/ui/storybook`. Storybook on 6008; `pnpm storybook` starts every
  package's (VS Code does when the folder opens).

<!-- /stacks:block:ui -->
<!-- stacks:block:app:site -->

- `apps/site` (package `site`) — stacks: a static site. Astro pages
  (`src/pages`), Markdown posts (`src/content/posts`, typed in `src/content.config.ts`), and
  React components for anything Chakra draws.
  - `pnpm --filter site dev` (port 3000), `build`, `preview`; Storybook on 6009.
  - A React component in a page renders to HTML at build time and ships no JavaScript;
    `client:load` (or `client:visible`) makes it interactive. Ship JavaScript only where a
    component responds to the user.
  - Every React component a page uses directly is its own root, so it wraps itself in
    `IslandProvider` (`@stacks/ui/island`). The layout renders `ChakraStyles` once, in `<head>`.
  - `typecheck` covers `.astro` files too: `tsconfig.json`'s `contentMappers` hands them to
    `@astrojs/ts-content-mapper`, which needs TypeScript 7.1+ and `tsc --runExternalCode`.
    oxlint and oxfmt skip `.astro` files, so keep logic in `.ts` files.

<!-- /stacks:block:app:site -->
<!-- stacks:apps:end -->

## Commands

| Task                 | Command                                                                      |
| -------------------- | ---------------------------------------------------------------------------- |
| Install              | `pnpm install` (also runs `agents:sync`; `corepack enable` once for pnpm)    |
| Tests                | `pnpm test`                                                                  |
| Typecheck, build     | `pnpm typecheck` / `pnpm build`                                              |
| Lint, format         | `pnpm lint` / `pnpm format` (oxlint and oxfmt, from the root)                |
| Agent skills         | `pnpm skills` (Intent's `list`); `pnpm exec intent load <package>#<skill>`   |
| Add an app           | `pnpm stacks add <stack> <name>` (`pnpm stacks list` for stacks)             |
| Update stacks' parts | `pnpm stacks update` (the AGENTS.md blocks and MCP servers; `--check` in CI) |

Run one package's script with `pnpm --filter <name> <script>`. Shared dependency versions live in
the `catalog:` in `pnpm-workspace.yaml`; a package asks for one with `"catalog:"`, so every package
gets the same versions.

## Rules

- **pnpm only.** Never run `npm`, `npx` or `yarn`: use `pnpm`, `pnpm exec` and `pnpm dlx`. The root
  `package.json` refuses other package managers (`devEngines`, `packageManager`).
- **Imports inside an app or package use `#/`** (`#/components/Header`) where its `tsconfig.json`
  has `paths`, and relative paths with extensions (`./greet.ts`) where it runs on Node directly.
- **Types over casts** in TypeScript: narrow with a guard instead of `as`.
- **The site documents the CLI.** `apps/site` is https://stacks.taxiera.net, made by
  `stacks add astro site`. Its Markdown is docs, not posts: `src/content/docs`, ordered by
  `order`, in place of the template's `src/content/posts`. A change to what `stacks` does updates
  those docs in the same commit as the skill. The stacks and add-ons tables are read from
  `packages/cli/src/stacks.ts` as the site builds (`src/stacks-data.ts`), so they need no edits.
  The custom domain is in `apps/site/wrangler.jsonc`; the deploy token also needs "Workers
  Routes: Edit" on the `taxiera.net` zone.

<!-- stacks:rules:start -->
<!-- stacks:block:skill:cli -->

- **A change to what `stacks` does updates its skill** (`packages/cli/skills/stacks/SKILL.md`) in
  the same commit: a new command, flag or behaviour, or one that's gone. Keep its frontmatter's
  `sources` pointing at the files it describes. Check it with `pnpm --filter @alex-taxiera/stacks skills:check`.
  The release workflow sets `library_version`; don't edit it by hand.

<!-- /stacks:block:skill:cli -->
<!-- stacks:block:release:cli -->

- **`@alex-taxiera/stacks` releases from `.github/workflows/release-cli.yml`**: Actions → Run, pick a bump.
  It tags `cli@v<version>`, sets the version in `package.json` and the skill's
  `library_version`, publishes to npm with provenance and makes a GitHub release. Never
  edit `version` by hand. Publishing uses npm trusted publishing: add this repo and workflow
  as a trusted publisher of `@alex-taxiera/stacks` on npmjs.com once, before the first release.
  To cut one, load the `release-cli` skill (`.agents/skills/release-cli`): it has every
  step, check and recovery.

<!-- /stacks:block:release:cli -->
<!-- stacks:block:deploy:site -->

- **`apps/site` deploys to Cloudflare Workers** (static assets, `wrangler.jsonc`) from `trunk` through `.github/workflows/deploy-site.yml`, which needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets.
  Each pull request that changes it gets a preview (`.github/workflows/preview-site.yml`):
  a version of the Worker uploaded but not deployed, linked from the run's summary. Previews
  start working once the first deploy has created the Worker.

<!-- /stacks:block:deploy:site -->
<!-- stacks:rules:end -->

<!-- stacks:ui:start -->
<!-- stacks:block:ui -->

## UI

- **Chakra UI v3**, not v2: compound components (`Dialog.Root`, `Switch.Root`…) and
  `colorPalette`. Check an unfamiliar component's API with the `chakra-ui` MCP server before using
  it, and load the `chakra-ui-builder` skill (or `chakra-ui-refactor`) for UI work.
- **Reach for a snippet before a compound component.** `packages/ui/src/components/ui` holds
  Chakra's snippets, shared by every app, so a component writes `<Switch checked>Label</Switch>`,
  not the five parts behind it. oxlint enforces it: importing a component that has a snippet (or
  could have one) from `@chakra-ui/react` is an error outside `packages/ui/src` and `.storybook`.
  Before writing UI, check what's there with the `storybook-ui` MCP's `docs-list`. Add a missing
  snippet with `pnpm --filter @stacks/ui exec chakra snippet add <name> --tsx --outdir src/components/ui`,
  convert it to React 19 style (`ref` as a prop, no `forwardRef`, no `"use client"`), import within
  the package by relative path, and give it a story so `docs-show` documents it.
- **Theme tokens, recipes and slot recipes live in `packages/ui/src/theme.ts`** and
  `packages/ui/src/recipes`, one system for every app. Run `pnpm --filter @stacks/ui typegen` after
  changing them so their props are typed. Use semantic tokens (`fg.muted`, `bg.subtle`,
  `accent.fg`…) over raw colours so both colour modes work.
- **Tell the user through a toast** from `@stacks/ui/notify`: `showError(title, error)` for anything
  that failed (it shows the error's message), `showSuccess`, `showInfo`, `showWarning`, and
  `showLoading(title, id)` for work in progress, which a later toast with the same `id` replaces.
- **A select, segmented control or tab list over a string union** narrows the value it reports
  with `findOption` (`@stacks/ui/options`), not a cast.

### Storybook and its MCP servers

Stories sit next to their component (`Header.tsx` and `Header.stories.tsx`) and every one runs as a
test under `pnpm test`. Each package has its own Storybook; the app Storybooks compose the library's
as a "UI library" ref. Shared preview setup (theme switcher, Chakra provider, toaster, a11y
settings) is `@stacks/ui/storybook`; each package's `.storybook/preview.tsx` spreads `basePreview` and
calls `resetUi()` in its `beforeEach`.

- Use the `storybook-<package>` MCP tools before answering questions about or changing UI
  components. Never guess props: call `docs-list` and `docs-show`, and use only props that are
  documented or shown in example stories. If a prop isn't documented, ask instead of assuming.
- Call `get-storybook-story-instructions` before creating or updating stories, and run `test-run`
  to verify your changes.
- Write or update a story when you create a reusable component or a snippet, or add props, states
  or variants to one. Cover each state the component can reach (empty, loading, error…), not every
  prop combination. Don't write stories for pages or thin wrappers.
- Add a `play` function that checks the behaviour a story is about, with role- or label-based
  queries. Chakra overlays (dialogs, tooltips, toasts) render in a portal: query them with
  `screen`, not `canvas`, and `waitFor` them to finish animating in.
- Don't wrap stories in a provider or add a `<Toaster />`; `.storybook/preview.tsx` does. Don't add
  `tags: ["autodocs"]` or a `title`; titles come from the file path.
- Prefer presentational components that take callbacks (`onSave`) so stories pass `fn()` args.

### Accessibility

Storybook's a11y addon runs axe on every story. Violations are reported in the a11y panel and by
the MCP's `test-run`, but don't fail tests (`a11y.test: "todo"` in `@stacks/ui/storybook`).

- Fix structural issues yourself: labels, roles, `aria-label` on icon-only buttons, alt text,
  table headers, heading order.
- Ask before changing anything visual, such as colour contrast, sizes or focus styles: describe
  the issue and offer two or three options.
- Don't turn rules off to make a report go away.

<!-- /stacks:block:ui -->
<!-- stacks:ui:end -->

## Working on stacks

stacks is built the way it builds others: this repo is what `stacks new --stack cli` makes, and
`packages/cli` is the CLI. It ships the `stacks` skill (`pnpm exec intent load
@alex-taxiera/stacks#stacks`); load it, and its `references/layers.md`, before changing a layer.

- `packages/cli/src/cli.ts` — the entry point; `src/commands/` has `new`, `add`, `list`,
  `update` and `versions`; `src/prompts.ts` has the questions they ask in a terminal.
- `packages/cli/src/layers/` — one function per layer, `(ctx) => LayerSpec`. `src/stacks.ts` says
  which layers make each stack.
- `packages/cli/templates/<layer>/{root,ui,app}/` — the files each layer copies.
- `packages/cli/src/compose/` — the overlay (writes nothing until the whole scaffold succeeds), the
  merges, and `applyLayers`.
- `packages/cli/src/versions/`, `versions.json`, `versions.policy.json` — the known-good snapshot,
  its exceptions, and the resolver the canary (`.github/workflows/canary.yml`) uses.
- `packages/cli/scripts/e2e.ts` — scaffolds each case and runs its lint, format check, typecheck,
  tests, build and skill checks. CI and the canary run it.

| Task                | Command                                                           |
| ------------------- | ----------------------------------------------------------------- |
| Run the CLI         | `pnpm stacks <command>` (from source; Node 24 strips types)       |
| Unit tests          | `pnpm test`                                                       |
| Scaffold and verify | `pnpm --filter @alex-taxiera/stacks e2e --case <case>` (`--list`) |
| Refresh versions    | `pnpm stacks versions refresh --group <group> --write`            |

- **Templates never name a version.** Layers list package names; workflows say
  `__ACTION[owner/repo]__`; Cargo files say `__CRATE[tauri]__`; Docker files say `__IMAGE[postgres]__`, and `versions.policy.json`
  says which of an image's tags to follow. A new package, action or image needs a versions refresh, and
  `test/compose.test.ts` fails until it's in the snapshot.
- **Templates stay valid source**: tokens in strings or identifier positions, never a templating
  syntax. A token the context doesn't define fails the scaffold.
- **Merge, don't overwrite.** Root files an app touches go through the layer's `json`, `yaml`,
  `lines` and `agents`, so `add` can apply them to a repo that has them already. An add-on that
  needs code inside a stack's file fills a `// stacks:slot <name>` marker (`slots`), never a copy.
- **Copy conventions from the newest repos** (MTG-Art-Seeker and pokodex for tooling and agent setup,
  spellvendor for better-auth and Drizzle), stripped of anything domain-specific.
- **A template change that older CLIs can't produce** bumps `minCliVersion` in `versions.json`.
- Run the e2e cases a change touches before calling it done; unit tests alone don't catch a
  template that fails its own lint or build.
- **This repo's root files come from the templates.** When a `repo` or `cli` template changes,
  make the same change here (`packages/cli/templates/repo/root` ↔ the root).

## Agent config and MCP servers

`AGENTS.md`, `.agents/skills/` and `.agents/mcp.json` are the sources. `pnpm agents:sync` (run on
install, checkout and merge) generates `CLAUDE.md`, `.claude/skills/`, and the MCP configs for
Claude Code (`.mcp.json`), Cursor (`.cursor/mcp.json`) and VS Code (`.vscode/mcp.json`). Those
are gitignored: edit the sources, never the generated files. Skills from other repositories come
from `pnpm dlx skills add <owner/repo>` and are pinned in `skills-lock.json`; skills that ship
inside packages are Intent's (above).

<!-- stacks:mcp:start -->
<!-- stacks:block:chakra-ui -->

- `chakra-ui` — Chakra's component docs, props and examples.

<!-- /stacks:block:chakra-ui -->
<!-- stacks:block:storybook-ui -->

- `storybook-ui` — `packages/ui`'s Storybook, port 6008. Each app's Storybook is `storybook-<app>`, and is only up while it runs.

<!-- /stacks:block:storybook-ui -->
<!-- stacks:block:storybook-site -->

- `storybook-site` — `apps/site`'s Storybook, port 6009.

<!-- /stacks:block:storybook-site -->
<!-- stacks:mcp:end -->

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
`<type>(<scope>): <description>`, for example `feat(web): add sign-in page` or
`chore(deps): bump vite`. Types: `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`,
`build`, `ci`, `chore`. Scope by app or package. Imperative, lower case, no trailing period; mark
breaking changes with `!` and a `BREAKING CHANGE:` footer. The default branch is `trunk`.

The pre-commit hook runs lint-staged (oxlint `--fix` and oxfmt on staged files). Don't skip it with
`--no-verify`; fix what it reports.

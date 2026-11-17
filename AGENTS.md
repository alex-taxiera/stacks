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
<!-- stacks:apps:end -->

## Commands

| Task             | Command                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| Install          | `pnpm install` (also runs `agents:sync`; `corepack enable` once for pnpm)     |
| Tests            | `pnpm test`                                                                   |
| Typecheck, build | `pnpm typecheck` / `pnpm build`                                               |
| Lint, format     | `pnpm lint` / `pnpm format` (oxlint and oxfmt, from the root)                 |
| Agent skills     | `pnpm skills` (Intent's `list`); `pnpm exec intent load <package>#<skill>`    |
| Add an app       | `pnpm dlx @alex-taxiera/stacks add <stack> <name>` (`stacks list` for stacks) |

Run one package's script with `pnpm --filter <name> <script>`. Shared dependency versions live in
the `catalog:` in `pnpm-workspace.yaml`; a package asks for one with `"catalog:"`, so every package
gets the same versions.

## Rules

- **pnpm only.** Never run `npm`, `npx` or `yarn`: use `pnpm`, `pnpm exec` and `pnpm dlx`. The root
  `package.json` refuses other package managers (`devEngines`, `packageManager`).
- **Imports inside an app or package use `#/`** (`#/components/Header`) where its `tsconfig.json`
  has `paths`, and relative paths with extensions (`./greet.ts`) where it runs on Node directly.
- **Types over casts** in TypeScript: narrow with a guard instead of `as`.

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

<!-- /stacks:block:release:cli -->
<!-- stacks:rules:end -->

<!-- stacks:ui:start -->
<!-- stacks:ui:end -->

## Working on stacks

stacks is built the way it builds others: this repo is what `stacks new --stack cli` makes, and
`packages/cli` is the CLI. It ships the `stacks` skill (`pnpm exec intent load
@alex-taxiera/stacks#stacks`); load it, and its `references/layers.md`, before changing a layer.

- `packages/cli/src/cli.ts` — the entry point; `src/commands/` has `new`, `add`, `list` and
  `versions`.
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
  `__ACTION[owner/repo]__`; Docker files say `__IMAGE[postgres]__`, and `versions.policy.json`
  says which of an image's tags to follow. A new package, action or image needs a versions refresh, and
  `test/compose.test.ts` fails until it's in the snapshot.
- **Templates stay valid source**: tokens in strings or identifier positions, never a templating
  syntax. A token the context doesn't define fails the scaffold.
- **Merge, don't overwrite.** Root files an app touches go through the layer's `json`, `yaml`,
  `lines` and `agents`, so `add` can apply them to a repo that has them already.
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
<!-- stacks:mcp:end -->

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
`<type>(<scope>): <description>`, for example `feat(web): add sign-in page` or
`chore(deps): bump vite`. Types: `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`,
`build`, `ci`, `chore`. Scope by app or package. Imperative, lower case, no trailing period; mark
breaking changes with `!` and a `BREAKING CHANGE:` footer. The default branch is `trunk`.

The pre-commit hook runs lint-staged (oxlint `--fix` and oxfmt on staged files). Don't skip it with
`--no-verify`; fix what it reports.

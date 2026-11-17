# AGENTS.md

Guide for coding agents working in this repo. Read [README.md](README.md) for what it is.

Sections between `<!-- stacks:… -->` markers are managed by [stacks](https://github.com/alex-taxiera/stacks):
`stacks add` and `stacks update` rewrite them. Edit outside the markers freely. Skill Loading is
Intent's: `pnpm exec intent install` writes it, word for word, and oxfmt leaves it alone.

<!-- prettier-ignore-start -->
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
<!-- prettier-ignore-end -->

## Shape

A pnpm workspace. Apps that deploy live in `apps/<name>`; packages that publish, and the shared UI
package, live in `packages/<name>`.

<!-- stacks:apps:start -->
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

<!-- stacks:rules:start -->
<!-- stacks:rules:end -->

<!-- stacks:ui:start -->
<!-- stacks:ui:end -->

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

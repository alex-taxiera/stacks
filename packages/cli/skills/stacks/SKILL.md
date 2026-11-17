---
name: stacks
description: >
  Work in a repo made by stacks (@alex-taxiera/stacks), the scaffolder for pnpm
  workspaces of Chakra UI apps and npm CLIs. Load before adding an app or
  package, changing root config stacks manages (AGENTS.md marker blocks,
  .agents/mcp.json, the pnpm catalog, .stacks.json), or bumping versions.
metadata:
  type: core
  library: "@alex-taxiera/stacks"
  library_version: "0.1.0"
sources:
  - "packages/cli/src/stacks.ts"
  - "packages/cli/src/commands/add.ts"
  - "packages/cli/src/commands/new.ts"
  - "packages/cli/src/compose/merge.ts"
  - "packages/cli/src/layers/**"
---

# Working in a stacks repo

A repo with a `.stacks.json` at its root was made by stacks. It's a pnpm workspace:

- Apps that deploy live in `apps/<name>`.
- Packages that publish live in `packages/<name>`.
- `packages/ui` holds the shared Chakra UI library, and exists once an app needs it.

## Add an app or package with `stacks add`, never by copying one

```sh
pnpm dlx @alex-taxiera/stacks list                         # stacks, deploy targets, add-ons
pnpm dlx @alex-taxiera/stacks add spa docs --deploy gh-pages --with e2e
pnpm dlx @alex-taxiera/stacks add cli tool --package-name @me/tool
```

`add` does several things that copying an app misses:

- It takes the next free ports: dev servers at 3000, 3010 and so on; Storybooks from 6009.
- It creates `packages/ui` if this is the first app with a UI.
- It merges the new app into the root:
  - its AGENTS.md block
  - its MCP server in `.agents/mcp.json`
  - the catalog entries it needs
  - its `intent.skills` entry
  - its deploy or release workflow
- It records the app in `.stacks.json`.

| Stack   | Lands in          | What                                                                              | `--deploy`               |
| ------- | ----------------- | --------------------------------------------------------------------------------- | ------------------------ |
| `spa`   | `apps/<name>`     | Vite, TanStack Router, every page prerendered                                     | `cloudflare`, `gh-pages` |
| `start` | `apps/<name>`     | Rendered on the server: TanStack Start, better-auth, Drizzle on Postgres          | `docker`, `cloudflare`   |
| `tauri` | `apps/<name>`     | A Tauri 2 desktop app; the first also makes the Cargo workspace and `crates/core` | `releases`               |
| `cli`   | `packages/<name>` | A Node CLI published to npm, shipping a skill like this one                       | `npm`                    |

Run `add` from anywhere inside the repo, then review `git diff` and commit. It never overwrites a
file that exists, and it fails if the name is taken.

## What stacks manages

- **AGENTS.md between `<!-- stacks:block:<id> -->` and `<!-- /stacks:block:<id> -->`.**
  `stacks add` and `stacks update` rewrite these blocks. Put your own guidance outside the markers;
  edits inside them are lost.
- **`.agents/mcp.json`, `.agents/skills/` and `AGENTS.md` are the sources.** `pnpm agents:sync` (run
  on install, checkout and merge) generates `CLAUDE.md`, `.mcp.json`, `.cursor/mcp.json`,
  `.vscode/mcp.json` and `.claude/skills/`. Those are gitignored; never edit them.
- **`pnpm-workspace.yaml`'s `catalog:`** holds one version of every shared dependency. Packages ask
  for `"catalog:"`.
  - Change a version in the catalog, never in a package.
  - `add` only adds missing entries and never upgrades one. It warns when an entry is a major
    behind stacks' known-good version.
- **`.stacks.json`** records the repo, the UI package and every app with its ports. `add` reads it.
  Don't hand-edit it unless you're renaming something by hand and keeping it in step.

## Rules that hold in every stacks repo

- **pnpm only.** `npm` and `npx` refuse to run here (`devEngines`); use `pnpm exec` and `pnpm dlx`.
- **Chakra snippets come from the UI package.** Import `@<scope>/ui/<snippet>`, never a snippet
  component from `@chakra-ui/react` (oxlint enforces it). Add a missing one with
  `pnpm --filter @<scope>/ui exec chakra snippet add <name> --tsx --outdir src/components/ui`.
- **A CLI package's skill changes with the CLI.** `packages/<name>/skills/<bin>/SKILL.md` is
  published with the package; update it in the same commit as the behaviour, and run
  `pnpm --filter <package> skills:check`.
- **Versions:** Dependabot opens grouped weekly PRs. To hold a package back, pin its range in the
  catalog and say why in a comment beside it.

## Working on stacks itself

For the layer and template model, and how to add a stack, deploy target or add-on, read
[references/layers.md](references/layers.md).

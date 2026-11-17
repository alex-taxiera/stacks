# AGENTS.md

Guide for coding agents working on stacks. Read [README.md](README.md) for what it does.

## Shape

- `src/cli.ts` — the entry point; `src/commands/` has `new`, `add`, `list` and `versions`.
- `src/layers/` — one function per layer, `(ctx) => LayerSpec`: the package names, scripts, merged
  JSON and YAML, AGENTS.md blocks, MCP servers and post-install steps it contributes. A layer is
  a repo layer (`repo`, `ui`, applied once by `new`) or an app layer (a stack, a deploy target, an
  add-on).
- `src/stacks.ts` — which layers make each stack, and its deploy targets and add-ons.
- `templates/<layer>/{root,ui,app}/` — files copied to the repo root, `packages/ui` and
  `apps/<name>`. `dot_` at the start of a path segment becomes `.`; `__TOKENS__` are filled from
  `src/compose/tokens.ts`.
- `src/compose/` — the overlay (writes nothing until the whole scaffold succeeds), the merges
  (`deepMerge`, AGENTS.md blocks, the pnpm catalog) and `applyLayers`.
- `src/versions/` — the snapshot loader and the resolver the canary uses.
- `versions.json`, `versions.policy.json` — the known-good snapshot and its exceptions.
- `scripts/e2e.ts` — scaffolds each case and runs its lint, format check, typecheck, tests and
  build. CI and the canary run it.

## Commands

| Task                | Command                                                     |
| ------------------- | ----------------------------------------------------------- |
| Install             | `pnpm install`                                              |
| Unit tests          | `pnpm test`                                                 |
| Scaffold and verify | `node scripts/e2e.ts --case <case>` (`--list`, `--keep`)    |
| Run the CLI         | `pnpm stacks <command>` (from source, Node 24 strips types) |
| Typecheck, build    | `pnpm typecheck` / `pnpm build`                             |
| Lint, format        | `pnpm lint` / `pnpm format`                                 |
| Refresh versions    | `pnpm stacks versions refresh --write`                      |

## Rules

- **Templates never name a version.** List package names in the layer; they reach the generated
  repo through its `catalog:` from `versions.json`. A workflow names an action as
  `__ACTION[owner/repo]__`. A new package or action needs `pnpm stacks versions refresh --write`,
  and `test/compose.test.ts` fails until it's in the snapshot.
- **Templates stay valid source.** Use `__UI_PKG__`-style tokens in strings or identifier
  positions so the files still parse; never a templating syntax. A token the context doesn't
  define fails the scaffold.
- **Merge, don't overwrite.** Repo-level files an app touches (`.agents/mcp.json`, AGENTS.md,
  `pnpm-workspace.yaml`, `.gitignore`) go through `json`, `yaml`, `lines` and `agents` in the
  layer spec, so `add` can apply them to a repo that already has them. Only an app's own files
  and its own workflow are templates.
- **Copy conventions from the newest repos**, not the oldest: MTG-Art-Seeker and pokodex for
  tooling, agent setup and Storybook; spellvendor for better-auth and Drizzle. Strip anything
  domain-specific.
- **A change to a template that a generated repo would need a newer CLI for** bumps
  `minCliVersion` in `versions.json`, so older CLIs fall back to their bundled snapshot.
- Run `node scripts/e2e.ts` for any case a change touches before calling it done; unit tests
  alone don't catch a template that fails its own lint or build.
- **pnpm only**, in this repo and in what it generates. Never `npm`, `npx` or `yarn`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
`feat(spa): …`, `fix(compose): …`, `chore(versions): …`. Imperative, lower case, no trailing
period. The default branch is `trunk`.

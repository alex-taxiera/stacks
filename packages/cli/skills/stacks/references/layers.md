# How stacks builds a repo

A **layer** is a function, `(ctx) => LayerSpec`, in `packages/cli/src/layers/`. A spec can declare
any of these:

- `packages`: per target (`root`, `ui` or `app`), the dependency names, scripts and other
  `package.json` fields
- `json`, `yaml` and `lines` patches for root files, deep-merged (arrays unioned)
- `agents` blocks for AGENTS.md's regions (`apps`, `rules`, `ui`, `mcp`)
- `mcp` servers, merged into `.agents/mcp.json`
- `post` steps run after the files are written (install, build, typegen…)

Its files live in `packages/cli/templates/<layer id>/{root,ui,app}/`:

- `root` goes to the repo root, `ui` to `packages/ui`, `app` to the app's `dir`.
- A path segment starting `dot_` becomes `.`, so `dot_storybook/` becomes `.storybook/`.
- `__TOKENS__` are filled from `src/compose/tokens.ts`:
  - `__APP_NAME__`, `__APP_DIR__`, `__PACKAGE_NAME__`, `__BIN_NAME__`
  - `__UI_PKG__` (only when there's a UI package)
  - `__DEV_PORT__` (only for apps with ports)
  - `__ACTION[owner/repo]__`, for a GitHub Action's version

## Which layers run

- `new` applies `repo` once.
- Any app whose stack has `needsUi` applies `ui` first, if the repo has no UI package yet.
- Then the app's own layers run, in order: the stack's, its deploy target's, then its add-ons'.

All of this happens in `composeApp` (`src/scaffold.ts`), on an `Overlay`, which writes nothing
until the whole scaffold succeeds.

## Rules for changing stacks

- **No versions in templates.** Layers name packages and workflows name actions; versions come from
  `packages/cli/versions.json`.
  - A new package needs `pnpm stacks versions refresh --group <its group> --write`.
  - `test/compose.test.ts` fails until the snapshot has it.
- **Templates stay valid source.** Tokens go in strings or identifier positions, never a templating
  syntax.
- **Root files are merged, never overwritten.** `add` runs against a repo that already has them.
- **Verify with a scaffold.** Run `node packages/cli/scripts/e2e.ts --case <case>` for any case the
  change touches; it runs the generated repo's lint, format check, typecheck, tests, build and
  skill checks.
- **A template change that older CLIs can't produce** bumps `minCliVersion` in `versions.json`.

## Adding a stack

1. Add its id to `StackId` in `src/model.ts`.
2. Write `src/layers/<stack>.ts` and `templates/<stack>/app/`.
3. Add it to `STACKS` in `src/stacks.ts`, with `kind`, `needsUi`, `ports`, its deploy targets and
   its add-ons.
4. Refresh the snapshot for its new packages.
5. Add an e2e case in `scripts/e2e.ts`.
6. Add it to this skill's table in `SKILL.md`.

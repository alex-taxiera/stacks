# stacks

Scaffolds pnpm workspaces of Chakra UI apps, with the tooling and agent setup already in place:
oxlint and oxfmt, Storybook stories run as Vitest browser tests, husky and lint-staged, CI,
Dependabot, and an `AGENTS.md` plus `.agents/` that sync to Claude Code, Cursor and VS Code.

```sh
pnpm dlx @alex-taxiera/stacks new my-repo --stack spa
cd my-repo
pnpm dlx @alex-taxiera/stacks add spa docs --deploy gh-pages
```

## What a generated repo looks like

```
package.json          tooling only; pnpm is required (packageManager + devEngines)
pnpm-workspace.yaml   apps/*, packages/*, and a catalog: with every shared version
packages/ui           the Chakra snippets, theme, provider and shared Storybook preview
apps/<name>           one folder per app, each built on packages/ui
AGENTS.md, .agents/   agent instructions, skills and MCP servers (Chakra, one Storybook per package)
.stacks.json          what `stacks add` builds on
```

## Stacks

| Stack   | What                                                              | Deploys to                   |
| ------- | ----------------------------------------------------------------- | ---------------------------- |
| `spa`   | Vite, TanStack Router, every page prerendered to static HTML      | Cloudflare Workers, GH Pages |
| `start` | _Planned:_ TanStack Start, better-auth, Drizzle + Postgres        | Docker Compose, Cloudflare   |
| `tauri` | _Planned:_ Tauri 2 desktop app with a Rust core crate and updater | GitHub Releases              |
| `astro` | _Planned:_ Astro with React islands                               | Cloudflare Workers, GH Pages |

`stacks list` shows what this version has, with its deploy targets and add-ons.

## Keeping versions current

Templates never name a version. Layers list package names, and workflows say
`__ACTION[actions/checkout]__`; [`versions.json`](versions.json) fills them in. It's a
_known-good_ snapshot: every version in it has been scaffolded, linted, typechecked, tested and
built together.

- **`stacks new` reads the snapshot from this repo's `trunk`**, so an installed CLI gets new
  versions without a release, and falls back to the copy it ships with when offline.
  `--versions latest` resolves everything live instead (untested together); `--versions bundled`
  never touches the network.
- **The [canary](.github/workflows/canary.yml) refreshes it nightly.** It resolves the newest
  version of each package, skipping releases under three days old, and groups the changes
  (storybook, tanstack, chakra…). Each group is tested on its own against every scaffold case:
  - Passing minor and patch groups are committed to `trunk`.
  - Passing groups with a major bump go into one `canary/majors` PR for review.
  - Failing groups open an issue. One broken release never holds the others back.
- **[`versions.policy.json`](versions.policy.json) holds the exceptions**: the Node major
  (24 until machines move to 26), `@types/node` tracking it, and a `range` for anything that has
  to wait.
- **Generated repos stay current on their own**, with grouped Dependabot PRs and pnpm's
  `minimumReleaseAge`. `add` never upgrades an existing catalog entry; it warns when the
  repo's is a major behind.

```sh
pnpm stacks versions                    # summarise the snapshot
pnpm stacks versions refresh            # what's newer, without writing
pnpm stacks versions refresh --write    # update versions.json
```

## Developing

```sh
pnpm install
pnpm test                                  # unit tests
node scripts/e2e.ts --case spa-cloudflare  # scaffold a case and run its lint, tests and build
pnpm stacks new ../tmp-repo --stack spa    # the CLI from source
```

See [AGENTS.md](AGENTS.md) for how the layers and templates fit together.

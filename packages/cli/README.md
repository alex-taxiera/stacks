# stacks

Scaffolds pnpm workspaces of Chakra UI apps and npm CLIs, with the tooling and agent setup already
in place:

- oxlint and oxfmt
- Storybook stories run as Vitest browser tests
- husky and lint-staged, CI and Dependabot
- an `AGENTS.md` plus `.agents/` that sync to Claude Code, Cursor and VS Code
- TanStack Intent, so agents can load the skills packages ship

```sh
pnpm dlx @alex-taxiera/stacks new my-repo --stack spa
cd my-repo
pnpm dlx @alex-taxiera/stacks add spa docs --deploy gh-pages
pnpm dlx @alex-taxiera/stacks add cli tool --package-name @me/tool
```

## What a generated repo looks like

```
package.json          tooling only; pnpm is required (packageManager + devEngines)
pnpm-workspace.yaml   apps/*, packages/*, and a catalog: with every shared version
apps/<name>           apps that deploy
packages/<name>       packages that publish, such as a CLI
packages/ui           the Chakra snippets, theme, provider and shared Storybook preview, made with
                      the first app that needs it
AGENTS.md, .agents/   agent instructions, skills and MCP servers (Chakra, one Storybook per package)
.stacks.json          what `stacks add` builds on
```

## Stacks

| Stack   | What                                                                     | Deploys to                         |
| ------- | ------------------------------------------------------------------------ | ---------------------------------- |
| `spa`   | Vite, TanStack Router, every page prerendered to static HTML             | Cloudflare Workers, GH Pages       |
| `cli`   | A Node CLI that ships an agent skill through TanStack Intent             | npm, with provenance               |
| `start` | TanStack Start on Nitro, TanStack Query, better-auth, Drizzle + Postgres | Docker Compose, Cloudflare Workers |
| `tauri` | Tauri 2 desktop app: a Vite, React and Chakra window over a Rust core    | GitHub Releases                    |
| `astro` | _Planned:_ Astro with React islands                                      | Cloudflare Workers, GH Pages       |

`stacks list` shows what this version has, with its deploy targets and add-ons. Apps with a UI
take add-ons with `--with` (a `tauri` app only `zustand`): `e2e` (Playwright tests of whole flows, with a CI job; a `start`
app's brings Postgres), `zustand` (a store for state components share) and `sentry` (errors
and performance from the browser, and from a `start` app's server under Docker).

## Skills that ship with a CLI

A `cli` package publishes `skills/<bin>/SKILL.md` beside its code. Any project that installs it and
uses [TanStack Intent](https://tanstack.com/intent) can list and load the skill:

```sh
pnpm exec intent list
pnpm exec intent load @me/tool#tool
```

The generated repo's root depends on its own CLI with `workspace:*`, so agents working there get
the skill too. `skills:check` (in CI and the release workflow) validates it and flags it when it
falls behind the package's version. stacks does the same: it ships the `stacks` skill, for agents
working in a repo it made.

## Keeping versions current

Templates never name a version. Layers list package names, and workflows say
`__ACTION[actions/checkout]__`, Docker files `__IMAGE[postgres]__` and Cargo files
`__CRATE[tauri]__`; [`versions.json`](versions.json) fills them in. It's a
_known-good_ snapshot: every version in it has been scaffolded, linted, typechecked, tested and
built together.

- **`stacks new` reads the snapshot from this repo's `trunk`**, so an installed CLI gets new
  versions without a release, and falls back to the copy it ships with when offline.
  `--versions latest` resolves everything live instead (untested together); `--versions bundled`
  never touches the network.
- **The [canary](../../.github/workflows/canary.yml) refreshes it nightly.** It resolves the newest
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

From the repo root:

```sh
pnpm install
pnpm test                                                   # unit tests
pnpm --filter @alex-taxiera/stacks e2e --case cli           # scaffold a case, run its checks
pnpm stacks new ../tmp-repo --stack spa                     # the CLI from source
```

See [AGENTS.md](../../AGENTS.md) and the `stacks` skill's
[layer reference](skills/stacks/references/layers.md) for how the layers and templates fit together.

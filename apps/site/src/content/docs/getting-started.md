---
title: Getting started
description: Make a repo with its first app, and find your way around what stacks made.
order: 1
---

## What you need

- **Node 24** or newer.
- **pnpm**. Every repo stacks makes requires it: `npm`, `npx` and `yarn` refuse to run there.
  Run `corepack enable` once if you don't have it.
- **git**, and optionally the GitHub CLI (`gh`). stacks reads your `gh` login to fill in the
  repo's `repository` fields.

## Make a repo

```sh
pnpm dlx @alex-taxiera/stacks new my-repo
```

In a terminal, `new` asks for anything you didn't pass:

- the first app's stack and name
- where it deploys
- its add-ons
- whether to install

Then it shows its plan, with the same command written out as flags, so you can run it again
without the questions. Without a terminal, or with `--yes`, it asks nothing and takes the
defaults. Agents and scripts pass flags:

```sh
pnpm dlx @alex-taxiera/stacks new my-repo --stack spa --deploy cloudflare --with e2e --yes
```

| Option                  | What                                                           |
| ----------------------- | -------------------------------------------------------------- |
| `--stack <id>`          | The first app's stack: `spa`, `start`, `astro`, `tauri`, `cli` |
| `--app <name>`          | Its folder under `apps/` or `packages/`                        |
| `--package-name <n>`    | Its package name, such as `@me/tool` for a published package   |
| `--title <text>`        | The repo's title                                               |
| `--github <owner/repo>` | Where it lives on GitHub                                       |
| `--deploy <target>`     | Where the app deploys                                          |
| `--with <a,b>`          | Add-ons                                                        |
| `--accent <palette>`    | The Chakra palette for the accent colour (default `teal`)      |
| `--no-install`          | Write the files only                                           |
| `--no-git`              | Don't make a git repo and first commit                         |

Run a bare `stacks` in a terminal for a menu of everything it can do.

## What you get

```
package.json          tooling only; pnpm is required (packageManager + devEngines)
pnpm-workspace.yaml   apps/*, packages/*, and a catalog: with every shared version
apps/<name>           apps that deploy
packages/<name>       packages that publish, such as a CLI
packages/ui           the Chakra snippets, theme, provider and shared Storybook preview,
                      made with the first app that needs it
AGENTS.md, .agents/   agent instructions, skills and MCP servers
.stacks.json          what `stacks add` builds on
```

The repo's root depends on stacks, so from here on `pnpm stacks` runs the version it was made
with. Every repo has the same scripts:

| Task             | Command                          |
| ---------------- | -------------------------------- |
| Tests            | `pnpm test`                      |
| Typecheck, build | `pnpm typecheck` / `pnpm build`  |
| Lint, format     | `pnpm lint` / `pnpm format`      |
| One package      | `pnpm --filter <name> <script>`  |
| Add an app       | `pnpm stacks add <stack> <name>` |
| Update stacks    | `pnpm stacks update`             |

Every shared dependency's version lives once, in the `catalog:` in `pnpm-workspace.yaml`, and
packages ask for it with `"catalog:"`.

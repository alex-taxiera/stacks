---
title: Adding apps
description: Grow a repo with stacks add, and what it does that copying an app misses.
order: 4
---

A repo stacks made takes more apps and packages, of any stack, with `stacks add`. Run it from
anywhere inside the repo:

```sh
pnpm stacks add spa docs --deploy gh-pages --with e2e
pnpm stacks add cli tool --package-name @me/tool
```

In a terminal, `add` asks for anything you didn't pass, then shows the plan and the same command
as flags. With `--yes`, or without a terminal, it needs `<stack> <name>` and takes the defaults for
the rest.

## What it does

Copying an existing app gets most of the files and misses everything around them. `add`:

- **Takes the next free ports.** Dev servers start at 3000, then 3010 and so on; Storybooks start
  at 6009.
- **Creates `packages/ui`** if this is the repo's first app with a UI.
- **Merges the app into the root**:
  - its block in `AGENTS.md`
  - its Storybook's MCP server in `.agents/mcp.json`
  - the catalog entries it needs
  - its `intent.skills` entry
  - its deploy or release workflow
- **Records the app in `.stacks.json`**, which later `add` and `update` runs read.

It never overwrites a file that exists, and it fails if the name is taken. Review `git diff`
afterwards and commit.

## Options

| Option               | What                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `--title <text>`     | The app's title (default: from its name)                               |
| `--package-name <n>` | Its package name, such as `@me/tool`                                   |
| `--deploy <target>`  | Where it deploys; see [Stacks](/docs/stacks/)                          |
| `--with <a,b>`       | Add-ons; see [Add-ons](/docs/add-ons/)                                 |
| `--versions <mode>`  | `known-good` (default), `latest` or `bundled`, for new catalog entries |
| `--no-install`       | Write the files only                                                   |
| `--cwd <dir>`        | The repo's root (default: here)                                        |

## Rules every repo keeps

- **pnpm only.** Use `pnpm exec` and `pnpm dlx`, never `npx`.
- **Chakra snippets come from the UI package.** Import `@<scope>/ui/<snippet>`, never a snippet
  component straight from `@chakra-ui/react`; oxlint enforces it. Add a missing one with
  `pnpm --filter @<scope>/ui exec chakra snippet add <name> --tsx --outdir src/components/ui`.
- **Change a version in the catalog**, never in one package.

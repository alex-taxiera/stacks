# __REPO_TITLE__

A pnpm workspace made with [stacks](https://github.com/alex-taxiera/stacks).

## Getting started

```sh
corepack enable   # once, for pnpm
pnpm install
pnpm storybook    # every package's Storybook
```

Each app's README section in [AGENTS.md](AGENTS.md) lists how to run it.

## Layout

- `packages/ui` (`__UI_PKG__`): the shared Chakra UI components, theme and Storybook preview.
- `apps/*`: the apps. Add another with `pnpm dlx @alex-taxiera/stacks add <stack> <name>`.

## Tooling

oxlint and oxfmt (`pnpm lint`, `pnpm format`), TypeScript, Vitest with every Storybook story run as
a browser test (`pnpm test`), husky and lint-staged. Dependabot opens weekly update PRs.

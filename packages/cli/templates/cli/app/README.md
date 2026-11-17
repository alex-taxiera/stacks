# __PACKAGE_NAME__

__APP_TITLE__: a command-line tool.

```sh
pnpm dlx __PACKAGE_NAME__ hello Ada
```

## Commands

| Command                       | What it does                         |
| ----------------------------- | ------------------------------------ |
| `__BIN_NAME__ hello [name]`   | Greets someone (`--shout` in capitals) |
| `__BIN_NAME__ --version`      | Prints the version                   |

## For agents

The package ships a skill, [`skills/__BIN_NAME__/SKILL.md`](skills/__BIN_NAME__/SKILL.md), through
[TanStack Intent](https://tanstack.com/intent). In a project that has it installed:

```sh
pnpm exec intent list
pnpm exec intent load __PACKAGE_NAME__#__BIN_NAME__
```

## Developing

```sh
pnpm --filter __PACKAGE_NAME__ dev -- hello   # from source
pnpm --filter __PACKAGE_NAME__ test
pnpm --filter __PACKAGE_NAME__ skills:check   # the skill is valid and current
```

Releases go through `.github/workflows/release-__APP_NAME__.yml`.

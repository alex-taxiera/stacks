---
name: __BIN_NAME__
description: >
  Use the __BIN_NAME__ command-line tool (__PACKAGE_NAME__): greet someone with
  `__BIN_NAME__ hello [name]`, in capitals with --shout. Load this before
  running __BIN_NAME__ or writing scripts that call it.
metadata:
  type: core
  library: "__PACKAGE_NAME__"
  library_version: "0.0.0"
sources:
  - "__APP_DIR__/src/cli.ts"
  - "__APP_DIR__/src/greet.ts"
---

# __BIN_NAME__

`__BIN_NAME__` is __APP_TITLE__'s command-line tool. Run it with `pnpm dlx __PACKAGE_NAME__` or,
where it's installed, `pnpm exec __BIN_NAME__`.

## Commands

| Command                       | Prints                                       |
| ----------------------------- | -------------------------------------------- |
| `__BIN_NAME__ hello`          | `Hello, world!`                              |
| `__BIN_NAME__ hello Ada`      | `Hello, Ada!`                                |
| `__BIN_NAME__ hello Ada --shout` | `HELLO, ADA!`                             |
| `__BIN_NAME__ --version`      | the installed version                        |
| `__BIN_NAME__ --help`         | usage                                        |

It exits 0 on success and 1 for an unknown command, printing the usage to stderr.

## Mistakes to avoid

- A blank name greets the world; don't pass `""` expecting an error.
- `--shout` changes the whole greeting, not just the name.

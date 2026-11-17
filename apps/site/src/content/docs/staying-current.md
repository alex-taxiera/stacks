---
title: Staying current
description: How stacks picks versions, keeps them tested together, and updates what it manages.
order: 5
---

## Known-good versions

Templates never name a version. stacks fills versions in from `versions.json`, a _known-good_
snapshot: every version in it has been scaffolded, linted, typechecked, tested and built together.

- **`new` reads the snapshot from stacks' `trunk`**, so an installed CLI gets new versions without
  a release. Offline, it falls back to the copy it ships with.
- **A nightly canary refreshes it.**
  - It resolves the newest version of each package, skipping releases under three days old.
  - It groups the changes (storybook, tanstack, chakra…) and tests each group on its own against
    every stack.
  - Passing minor and patch groups are committed; passing major bumps go into one PR for review;
    failing groups open an issue.
  - One broken release never holds the others back.
- **`--versions`** picks another source:

| Mode         | Versions                                       |
| ------------ | ---------------------------------------------- |
| `known-good` | The snapshot. The default                      |
| `latest`     | Resolved live; untested together               |
| `bundled`    | The copy the CLI ships with; no network at all |

## After the repo is made

The repo stays current on its own:

- **Dependabot** opens grouped weekly PRs.
- **pnpm's `minimumReleaseAge`** keeps out releases under three days old.
- **The catalog** asks for `^<version>`, or the exact version of a prerelease, since a range would
  also take nightlies.

`stacks add` only adds catalog entries that are missing, and never upgrades one. It warns when an
entry is a major version behind the snapshot.

## `stacks update`

stacks manages a few parts of the repo:

- `AGENTS.md`'s blocks between `<!-- stacks:block:<id> -->` markers
- the servers it added to `.agents/mcp.json`

When stacks changes how it writes them, bring them up to date:

```sh
pnpm stacks update           # rewrite them, then pnpm run format and commit
pnpm stacks update --check   # exit 1 if anything would change, for CI
```

It leaves your own text outside the blocks, servers it doesn't name, and every other file as they
are. It also lists catalog entries that are a major version behind.

---
title: Agents and skills
description: How a stacks repo is set up for coding agents, and the skills its packages ship.
order: 6
---

Every repo stacks makes is set up for coding agents from its first commit.

## One source, every tool

The sources are:

- `AGENTS.md`, the guide agents read
- `.agents/skills/`
- `.agents/mcp.json`, the MCP servers

`pnpm agents:sync` runs on install, checkout and merge, and generates each tool's own files:

| Tool        | Generated files                             |
| ----------- | ------------------------------------------- |
| Claude Code | `CLAUDE.md`, `.claude/skills/`, `.mcp.json` |
| Cursor      | `.cursor/mcp.json`                          |
| VS Code     | `.vscode/mcp.json`                          |

They're gitignored. Edit the sources, never the generated files.

Repos with a UI get MCP servers for Chakra's docs and for each package's Storybook. Agents then
look up a component's real props instead of guessing them. Every story runs as a Vitest browser
test, with axe checking accessibility.

## Skills that ship with a package

A `cli` package publishes `skills/<bin>/SKILL.md` beside its code. Any project that installs it and
uses [TanStack Intent](https://tanstack.com/intent) can list and load the skill:

```sh
pnpm exec intent list
pnpm exec intent load @me/tool#tool
```

The repo's root depends on its own CLI with `workspace:*`, so agents working in the repo get the
skill too. `skills:check` validates it in CI and in the release workflow, and flags it when it
falls behind the package's version.

stacks does the same. It ships the `stacks` skill, so an agent in a repo stacks made can load it
before adding an app or changing what stacks manages:

```sh
pnpm exec intent load @alex-taxiera/stacks#stacks
```

---
title: Stacks
description: The five kinds of app or package stacks makes, and where each one deploys.
order: 2
appendix: stacks
---

A stack is one kind of app or package. Every repo starts with one; `stacks add` adds more, of any
stack, to the same repo. Apps that deploy land in `apps/<name>`, and packages that publish in
`packages/<name>`.

Every stack with a UI is React and Chakra UI v3. It shares `packages/ui` with the repo's other
apps: Chakra's snippets, the theme and the Storybook preview. The first app that needs it creates
it.

- **`spa`**: a client-only app with Vite and TanStack Router. Every page is prerendered to static
  HTML, so it deploys as files.
- **`start`**: rendered on the server with TanStack Start on Nitro. It comes with TanStack Query,
  better-auth, and Drizzle on Postgres. It runs under Docker Compose on one server behind Traefik,
  or on Cloudflare Workers with Postgres through Hyperdrive. Under Compose, rollouts have no
  downtime.
- **`astro`**: a site of pages. Astro pages and Markdown content, with Chakra drawn in React
  islands that ship JavaScript only where a component responds to the user. This site is one.
- **`tauri`**: a Tauri 2 desktop app, a Vite, React and Chakra window over a Rust core.
  - The first one also makes the root Cargo workspace and `crates/core`, whose types reach
    TypeScript through ts-rs.
  - Releases are draft GitHub releases with installers for Windows, macOS and Linux.
- **`cli`**: a Node command-line tool, published to npm with provenance from a release workflow.
  It ships an agent skill beside its code; see [Agents and skills](/docs/agents/).

Every deploy target comes with its workflow, filtered to the paths that app depends on. A `spa` or
`astro` app on Cloudflare also gets a preview of each pull request: a version of its Worker
uploaded but not deployed, and linked from the run's summary.

## Every stack

This table is read from the CLI's own source when this site is built. `pnpm stacks list` prints
the same, for the version you have.

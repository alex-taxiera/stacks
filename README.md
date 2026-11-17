# stacks

A scaffolder for pnpm workspaces of Chakra UI apps and npm CLIs. It brings the tooling and agent
setup with it, and keeps versions current through a nightly canary.

This repo is itself what `stacks new --stack cli` makes:

- the workspace root holds the tooling
- [`packages/cli`](packages/cli) is the CLI, published as `@alex-taxiera/stacks`

The CLI ships the `stacks` skill through TanStack Intent. Run `pnpm skills` to list it.

```sh
pnpm dlx @alex-taxiera/stacks new my-repo --stack spa
```

Read [packages/cli/README.md](packages/cli/README.md) for the stacks, how versions stay current, and
how to develop it. [AGENTS.md](AGENTS.md) is the guide for coding agents.

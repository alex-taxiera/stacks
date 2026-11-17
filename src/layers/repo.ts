import type { Layer } from "../model.ts";

/** The workspace root: tooling, agent setup, CI. `stacks new` applies it once. */
export const repo: Layer = (ctx) => ({
  id: "repo",
  packages: {
    root: {
      devDependencies: ["@types/node", "husky", "lint-staged", "oxfmt", "oxlint", "typescript"],
      scripts: {
        build: "pnpm -r build",
        test: "pnpm -r test",
        typecheck: "tsc --noEmit && pnpm -r typecheck",
        lint: "oxlint",
        "lint:fix": "oxlint --fix",
        format: "oxfmt",
        "format:check": "oxfmt --check",
        storybook: "pnpm -r --parallel --no-bail storybook",
        "ci-storybook": "pnpm -r --parallel --no-bail ci-storybook",
        prepare: "husky",
        "agents:sync": "node scripts/sync-agents.ts",
        postinstall: "pnpm run agents:sync",
      },
      fields: {
        packageManager: `pnpm@${ctx.versions.pnpm}`,
        // npm refuses to install with another manager named here; yarn and others refuse
        // `packageManager` through corepack.
        devEngines: {
          packageManager: {
            name: "pnpm",
            version: `>=${ctx.versions.pnpm.split(".")[0]}`,
            onFail: "error",
          },
          runtime: { name: "node", version: `>=${ctx.versions.node}`, onFail: "warn" },
        },
        engines: { node: `>=${ctx.versions.node}` },
        "lint-staged": {
          "*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}": [
            "oxlint --fix --no-error-on-unmatched-pattern",
            "oxfmt --no-error-on-unmatched-pattern",
          ],
          "*.{json,jsonc,md,mdx,css,yml,yaml,html,toml}": "oxfmt --no-error-on-unmatched-pattern",
        },
      },
    },
  },
  yaml: {
    "pnpm-workspace.yaml": {
      packages: ["apps/*", "packages/*"],
      // Minutes. Skip releases younger than three days, as stacks' own version refresh does.
      minimumReleaseAge: 4320,
      allowBuilds: { esbuild: true },
    },
  },
  post: [
    { title: "Installing dependencies", command: "pnpm", args: ["install"] },
    {
      title: "Adding the Chakra UI agent skills",
      command: "pnpm",
      args: [
        "dlx",
        "skills",
        "add",
        "chakra-ui/chakra-ui",
        "--skill",
        "chakra-ui-builder",
        "--skill",
        "chakra-ui-refactor",
        "--skill",
        "chakra-ui-migrate",
        "--agent",
        "universal",
        "--copy",
        "--yes",
      ],
      needsInstall: true,
      optional: true,
      // It clones Chakra's repository, which can stall on a slow network.
      timeoutMs: 120_000,
    },
    {
      title: "Syncing agent config",
      command: "pnpm",
      args: ["run", "agents:sync"],
      needsInstall: true,
    },
    {
      title: "Generating Chakra theme types",
      command: "pnpm",
      args: ["--filter", ctx.repo.uiPackage, "typegen"],
      needsInstall: true,
    },
  ],
});

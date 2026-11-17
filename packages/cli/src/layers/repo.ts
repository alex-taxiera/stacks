import type { Layer } from "../model.ts";

/**
 * The workspace root: tooling, agent setup, CI. `stacks new` applies it once. Nothing here knows
 * about UI; the `ui` layer adds that with the first app that needs it.
 */
export const repo: Layer = (ctx) => ({
  id: "repo",
  packages: {
    root: {
      devDependencies: [
        // stacks itself, at the version the repo was made or last updated with: `pnpm stacks`.
        "@alex-taxiera/stacks",
        "@tanstack/intent",
        "@types/node",
        "husky",
        "lint-staged",
        "oxfmt",
        "oxlint",
        "typescript",
      ],
      scripts: {
        build: "pnpm -r build",
        test: "pnpm -r test",
        typecheck: "tsc --noEmit && pnpm -r typecheck",
        lint: "oxlint",
        "lint:fix": "oxlint --fix",
        format: "oxfmt",
        "format:check": "oxfmt --check",
        skills: "intent list",
        stacks: "stacks",
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
        // The packages whose skills agents may load with `pnpm exec intent load`. Each layer adds
        // its own: an app on TanStack Router adds `@tanstack/*`, a CLI here adds itself. stacks'
        // own skill is how agents learn to add apps and keep the managed parts current.
        intent: { skills: ["@alex-taxiera/stacks"] },
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
      // stacks itself is tested against every stack before it ships, and `stacks update` wants it
      // the day it does.
      minimumReleaseAgeExclude: ["@alex-taxiera/stacks"],
      allowBuilds: { esbuild: true },
    },
  },
  post: [
    {
      title: "Installing dependencies",
      command: "pnpm",
      // pnpm turns on --frozen-lockfile when CI is set; a new repo has no lockfile yet.
      args: ["install", "--no-frozen-lockfile"],
    },
    {
      title: "Syncing agent config",
      command: "pnpm",
      args: ["run", "agents:sync"],
      needsInstall: true,
    },
  ],
});

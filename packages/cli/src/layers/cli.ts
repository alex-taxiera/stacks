import type { Layer } from "../model.ts";
import { requireApp } from "./require.ts";

/** The command a package installs: its unscoped name (`@me/stacks` → `stacks`). */
export function binName(packageName: string): string {
  return packageName.split("/").at(-1) ?? packageName;
}

/**
 * A command-line tool in `packages/<name>`, published to npm, that ships an agent skill through
 * TanStack Intent. The repo's root depends on it, so the root's Intent setup finds that skill too.
 */
export const cli: Layer = (ctx) => {
  const app = requireApp(ctx.app);
  const pkg = app.packageName;
  const bin = binName(pkg);
  return {
    id: "cli",
    packages: {
      app: {
        devDependencies: ["@tanstack/intent", "@types/node", "typescript", "vitest"],
        scripts: {
          // Node 24 runs the TypeScript source directly; the build is for publishing.
          dev: "node src/cli.ts",
          build: "tsc -p tsconfig.build.json",
          typecheck: "tsc --noEmit",
          test: "vitest run",
          "skills:check": "intent validate skills && intent stale",
          prepack: "pnpm run build",
        },
        fields: {
          description: `${app.title}: a command-line tool.`,
          bin: { [bin]: "./dist/cli.js" },
          files: ["dist", "skills"],
          // How Intent finds a package that ships skills.
          keywords: ["tanstack-intent"],
          engines: { node: `>=${ctx.versions.node}` },
          repository: {
            type: "git",
            url: `git+https://github.com/${ctx.repo.github}.git`,
            directory: app.dir,
          },
          publishConfig: { access: "public", provenance: true },
        },
      },
      root: {
        workspaceDevDependencies: [pkg],
        fields: { intent: { skills: [`workspace:${pkg}`] } },
      },
    },
    lines: { ".gitignore": ["*.tgz"] },
    agents: [
      {
        region: "apps",
        id: `app:${app.name}`,
        body: [
          `- \`${app.dir}\` (\`${pkg}\`, the \`${bin}\` command) — ${app.title}: a command-line tool,`,
          "  published to npm. TypeScript that Node 24 runs directly, built with `tsc` for publishing.",
          `  - \`pnpm --filter ${pkg} dev -- --help\` runs it from source; \`build\`, \`test\`, \`skills:check\`.`,
          `  - It ships an agent skill, \`${app.dir}/skills/${bin}/SKILL.md\`, which Intent serves as`,
          `    \`${pkg}#${bin}\` to anyone who installs it, this repo included.`,
        ].join("\n"),
      },
      {
        region: "rules",
        id: `skill:${app.name}`,
        body: [
          `- **A change to what \`${bin}\` does updates its skill** (\`${app.dir}/skills/${bin}/SKILL.md\`) in`,
          "  the same commit: a new command, flag or behaviour, or one that's gone. Keep its frontmatter's",
          `  \`sources\` pointing at the files it describes. Check it with \`pnpm --filter ${pkg} skills:check\`.`,
          "  The release workflow sets `library_version`; don't edit it by hand.",
        ].join("\n"),
      },
    ],
    post: [
      // The root depends on the package, so its `bin` needs to exist for the link to work.
      {
        title: `Building ${pkg}`,
        command: "pnpm",
        args: ["--filter", pkg, "build"],
        needsInstall: true,
      },
    ],
  };
};

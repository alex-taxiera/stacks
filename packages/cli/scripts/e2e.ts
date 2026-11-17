// Scaffolds a repo the way a user would, then runs what its own CI runs: lint, format check,
// typecheck, tests (stories included, in headless Chromium) and build. CI runs every case on each
// pull request with the bundled versions; the nightly canary runs them with candidate versions.
//
//   node scripts/e2e.ts --list                       the cases, as JSON, for a workflow matrix
//   node scripts/e2e.ts --case spa-cloudflare        one case, with the bundled versions
//   node scripts/e2e.ts --case all --versions-file candidate.json
//   node scripts/e2e.ts --case spa-multi --keep      keep the scaffold to look at

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

interface Case {
  /** `stacks` argument lists, run in order: the first is `new`, the rest `add`s. */
  commands: string[][];
  /** Commands run in the repo after the usual checks, such as a CLI's own and Intent's. */
  after?: string[][];
}

/** A CLI's checks: its skill is valid, Intent finds and loads it, and the built bin runs. */
const cliChecks = (pkg: string, dir: string): string[][] => [
  ["pnpm", "--filter", pkg, "skills:check"],
  ["pnpm", "exec", "intent", "load", `${pkg}#${pkg.split("/").at(-1)}`],
  ["node", `${dir}/dist/cli.js`, "--version"],
  ["pnpm", "--filter", pkg, "dev", "hello", "e2e"],
];

const CASES: Record<string, Case> = {
  cli: {
    commands: [["new", "--stack", "cli", "--package-name", "@e2e/greeter", "--github", "e2e/repo"]],
    after: cliChecks("@e2e/greeter", "packages/cli"),
  },
  "cli-then-spa": {
    commands: [
      ["new", "--stack", "cli", "--app", "tool", "--github", "e2e/repo"],
      ["add", "spa", "web", "--deploy", "cloudflare"],
    ],
    after: cliChecks("tool", "packages/tool"),
  },
  // With every add-on; its Playwright tests run against the built site.
  "spa-cloudflare": {
    commands: [["new", "--stack", "spa", "--deploy", "cloudflare", "--with", "e2e,zustand,sentry"]],
    after: [["pnpm", "--filter", "web", "e2e"]],
  },
  "spa-multi": {
    commands: [
      ["new", "--stack", "spa", "--app", "web", "--deploy", "gh-pages", "--accent", "purple"],
      ["add", "spa", "docs", "--deploy", "cloudflare"],
    ],
  },
  // A Worker: Nitro writes its config, and wrangler checks the bundle and bindings without an
  // account.
  "start-cloudflare": {
    commands: [["new", "--stack", "start", "--deploy", "cloudflare", "--with", "e2e,zustand"]],
    after: [["pnpm", "--filter", "web", "exec", "wrangler", "deploy", "--dry-run"]],
  },
  // A start app added beside a spa: it shares packages/ui and takes the next ports. Its image
  // builds from the repo root, migrate stage included.
  "spa-then-start": {
    commands: [
      ["new", "--stack", "spa", "--app", "site", "--deploy", "cloudflare"],
      ["add", "start", "web", "--deploy", "docker", "--with", "sentry"],
    ],
    after: [
      ["docker", "build", "--file", "apps/web/Dockerfile", "--target", "migrate", "."],
      ["docker", "build", "--file", "apps/web/Dockerfile", "."],
    ],
  },
};

const { values } = parseArgs({
  options: {
    case: { type: "string" },
    list: { type: "boolean" },
    "versions-file": { type: "string" },
    keep: { type: "boolean" },
  },
});

if (values.list) {
  console.log(JSON.stringify(Object.keys(CASES)));
  process.exit(0);
}

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "src/cli.ts");
const isWindows = process.platform === "win32";

function sh(command: string, args: string[], cwd: string) {
  console.log(`\n$ ${command} ${args.join(" ")}   (in ${cwd})`);
  const result = spawnSync(
    isWindows ? [command, ...args].join(" ") : command,
    isWindows ? [] : args,
    {
      cwd,
      stdio: "inherit",
      shell: isWindows,
      env: { ...process.env, HUSKY: "0" },
    },
  );
  if (result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
}

function runCase(name: string, testCase: Case) {
  const parent = mkdtempSync(path.join(tmpdir(), `stacks-e2e-${name}-`));
  const repo = path.join(parent, "e2e-repo");
  const versions = values["versions-file"]
    ? ["--versions-file", path.resolve(values["versions-file"])]
    : ["--versions", "bundled"];
  try {
    const [first, ...rest] = testCase.commands;
    if (!first) throw new Error(`${name} has no commands`);
    sh("node", [cli, ...first, repo, ...versions, "--no-git", "--yes"], parent);
    for (const command of rest) sh("node", [cli, ...command, ...versions], repo);

    // What the generated repo's CI runs, in the same order.
    const setup = ["-r", "--if-present", "run", "test:setup"];
    if (process.env.CI) setup.push("--with-deps");
    sh("pnpm", setup, repo);
    for (const script of ["lint", "format:check", "typecheck", "test", "build"]) {
      sh("pnpm", ["run", script], repo);
    }
    sh("pnpm", ["-r", "--if-present", "run", "skills:check"], repo);
    for (const [command, ...args] of testCase.after ?? []) sh(command as string, args, repo);
    console.log(`\n✔ ${name}`);
  } finally {
    if (values.keep) console.log(`Kept ${repo}`);
    else rmSync(parent, { recursive: true, force: true });
  }
}

const selected =
  values.case === "all" || !values.case ? Object.keys(CASES) : values.case.split(",");
for (const name of selected) {
  const testCase = CASES[name];
  if (!testCase) throw new Error(`Unknown case "${name}"; choose ${Object.keys(CASES).join(", ")}`);
  runCase(name, testCase);
}

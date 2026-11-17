// Scaffolds a repo the way a user would, then runs what its own CI runs: lint, format check,
// typecheck, tests (stories included, in headless Chromium) and build. CI runs every case on each
// pull request with the bundled versions; the nightly canary runs them with candidate versions.
//
//   node scripts/e2e.ts --list                       the cases, as JSON, for a workflow matrix
//   node scripts/e2e.ts --case spa-cloudflare        one case, with the bundled versions
//   node scripts/e2e.ts --case all --versions-file candidate.json
//   node scripts/e2e.ts --case spa-multi --keep      keep the scaffold to look at

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

interface Case {
  /** `stacks` argument lists, run in order: the first is `new`, the rest `add`s. */
  commands: string[][];
}

const CASES: Record<string, Case> = {
  "spa-cloudflare": { commands: [["new", "--stack", "spa", "--deploy", "cloudflare"]] },
  "spa-multi": {
    commands: [
      ["new", "--stack", "spa", "--app", "web", "--deploy", "gh-pages", "--accent", "purple"],
      ["add", "spa", "docs", "--deploy", "cloudflare"],
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

    const { repo: info } = JSON.parse(readFileSync(path.join(repo, ".stacks.json"), "utf8")) as {
      repo: { uiPackage: string };
    };
    const playwright = ["--filter", info.uiPackage, "exec", "playwright", "install", "chromium"];
    if (process.env.CI) playwright.push("--with-deps");
    sh("pnpm", playwright, repo);
    for (const script of ["lint", "format:check", "typecheck", "test", "build"]) {
      sh("pnpm", ["run", script], repo);
    }
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

// Scaffolds a repo the way a user would, then runs what its own CI runs: lint, format check,
// typecheck, tests (stories included, in headless Chromium) and build. CI runs every case on each
// pull request with the bundled versions; the nightly canary runs them with candidate versions.
//
//   node scripts/e2e.ts --list                       the cases, as JSON, for a workflow matrix
//   node scripts/e2e.ts --case spa-cloudflare        one case, with the bundled versions
//   node scripts/e2e.ts --case all --versions-file candidate.json
//   node scripts/e2e.ts --case spa-multi --keep      keep the scaffold to look at

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

interface Case {
  /** `stacks` argument lists, run in order: the first is `new`, the rest `add`s. */
  commands: string[][];
  /** Commands run in the repo after the usual checks, such as a CLI's own and Intent's. */
  after?: string[][];
  /** Checks that need more than a command, run last. */
  verify?: (repo: string) => void;
}

/** A file's text with Unix line endings. */
const lines = (file: string) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");

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
  // Two desktop apps in one Cargo workspace: the first makes it and crates/core, the second only
  // joins. The Rust side is checked as the generated CI checks it.
  tauri: {
    commands: [
      ["new", "--stack", "tauri", "--with", "zustand,updater"],
      ["add", "tauri", "viewer"],
    ],
    after: [
      ["cargo", "fmt", "--all", "--check"],
      ["cargo", "clippy", "--workspace", "--all-targets", "--", "-D", "warnings"],
      ["cargo", "test", "--workspace"],
    ],
    // Against the template, not the scaffold: `cargo test` has already rewritten the file, as
    // ts-rs writes it before oxfmt does.
    verify: (repo) => {
      sh("pnpm", ["bindings"], repo);
      const written = lines(path.join(repo, "apps/desktop/src/bindings/Greeting.ts"));
      if (written !== lines(path.join(root, "templates/tauri/app/src/bindings/Greeting.ts")))
        throw new Error("The template's bindings differ from what ts-rs writes for crates/core");
    },
  },
  // A site of pages with islands, on a Worker that answers unknown paths with its 404 page.
  "astro-cloudflare": {
    commands: [["new", "--stack", "astro", "--deploy", "cloudflare"]],
    after: [["pnpm", "--filter", "site", "exec", "wrangler", "deploy", "--dry-run"]],
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

/** The updater signing keys a scaffold made in ~/.tauri: test keys, not the user's. */
function removeScaffoldKeys() {
  const dir = path.join(homedir(), ".tauri");
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir)) {
    if (file.includes(".e2e-repo.")) rmSync(path.join(dir, file));
  }
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
    // A fresh scaffold is what `update` would make it.
    sh("node", [cli, "update", "--check", ...versions], repo);

    // What the generated repo's CI runs, in the same order.
    const setup = ["-r", "--if-present", "run", "test:setup"];
    if (process.env.CI) setup.push("--with-deps");
    sh("pnpm", setup, repo);
    for (const script of ["lint", "format:check", "typecheck", "test", "build"]) {
      sh("pnpm", ["run", script], repo);
    }
    sh("pnpm", ["-r", "--if-present", "run", "skills:check"], repo);
    // stacks itself, installed from npm: its bin runs and Intent serves its skill.
    sh("pnpm", ["stacks", "list"], repo);
    sh("pnpm", ["exec", "intent", "load", "@alex-taxiera/stacks#stacks"], repo);
    for (const [command, ...args] of testCase.after ?? []) sh(command as string, args, repo);
    testCase.verify?.(repo);
    console.log(`\n✔ ${name}`);
  } finally {
    removeScaffoldKeys();
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

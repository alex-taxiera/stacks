// Scaffolds a repo the way a user would, then runs what its own CI runs: lint, format check,
// typecheck, tests (stories included, in headless Chromium) and build. CI runs every case on each
// pull request with the bundled versions; the nightly canary runs them with candidate versions.
//
//   node scripts/e2e.ts --list                       the cases, as JSON, for a workflow matrix
//   node scripts/e2e.ts --case spa-cloudflare        one case, with the bundled versions
//   node scripts/e2e.ts --case all --versions-file candidate.json
//   node scripts/e2e.ts --case spa-multi --keep      keep the scaffold to look at

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  // The app's own title bar, and its screenshots taken from its Storybook.
  "tauri-titlebar": {
    commands: [["new", "--stack", "tauri", "--with", "titlebar,updater,screenshots"]],
    after: [
      ["cargo", "fmt", "--all", "--check"],
      ["cargo", "clippy", "--workspace", "--all-targets", "--", "-D", "warnings"],
      ["pnpm", "--filter", "desktop", "screenshots"],
    ],
    verify: (repo) => {
      for (const scheme of ["light", "dark"]) {
        const shot = path.join(repo, `docs/screenshots/desktop/app-default-${scheme}.png`);
        if (!existsSync(shot)) throw new Error(`No screenshot at ${shot}`);
      }
    },
  },
  // A product site beside its desktop app: a Worker for /api/*, and a download page that builds
  // even before the app has a release.
  "astro-downloads": {
    commands: [
      ["new", "--stack", "tauri"],
      ["add", "astro", "site", "--deploy", "cloudflare", "--with", "worker,downloads"],
    ],
    after: [["pnpm", "--filter", "site", "exec", "wrangler", "deploy", "--dry-run"]],
  },
  // A site of pages with islands, on a Worker that answers unknown paths with its 404 page.
  "astro-cloudflare": {
    commands: [["new", "--stack", "astro", "--deploy", "cloudflare"]],
    after: [["pnpm", "--filter", "site", "exec", "wrangler", "deploy", "--dry-run"]],
  },
  // A start app added beside a spa: it shares packages/ui and takes the next ports. Its image
  // builds from the repo root, migrate stage included. Its production database backs up, and
  // restore.sh brings back an emptied one.
  "spa-then-start": {
    commands: [
      ["new", "--stack", "spa", "--app", "site", "--deploy", "cloudflare"],
      ["add", "start", "web", "--deploy", "docker", "--with", "sentry,backups"],
    ],
    after: [
      ["docker", "build", "--file", "apps/web/Dockerfile", "--target", "migrate", "."],
      ["docker", "build", "--file", "apps/web/Dockerfile", "."],
    ],
    verify: (repo) => verifyBackups(path.join(repo, "apps/web")),
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

/** Runs a command without a shell, so arguments keep their spaces; returns whether it passed. */
function run(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
  { capture = false, check = true } = {},
) {
  console.log(`\n$ ${command} ${args.join(" ")}   (in ${cwd})`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (check && result.status !== 0)
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}`);
  return { ok: result.status === 0, output: result.stdout ?? "" };
}

/** Checks `done` every two seconds until it's true, for up to `seconds`. */
function waitFor(what: string, done: () => boolean, seconds = 180) {
  for (let waited = 0; !done(); waited += 2) {
    if (waited >= seconds) throw new Error(`Gave up waiting for ${what}`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
  }
}

/**
 * The backups add-on, in the production Compose project with a repository on disk in place of S3
 * (which needs a bucket and TLS): the `backup` service sets up the stanza and takes a full backup,
 * then `restore.sh` brings back a data directory that was emptied.
 */
function verifyBackups(app: string) {
  // On the socket's volume, the one both services share and the postgres user can write.
  const repository = {
    PGBACKREST_REPO1_TYPE: "posix",
    PGBACKREST_REPO1_PATH: "/var/run/postgresql/backups",
  };
  writeFileSync(
    path.join(app, "compose.override.yaml"),
    JSON.stringify({
      services: { postgres: { environment: repository }, backup: { environment: repository } },
    }),
  );
  const env = {
    COMPOSE_PROJECT_NAME: "stacks-e2e-backups",
    // restore.sh's COMPOSE_FILE separates files with ":", as on Linux; Windows' default is ";".
    COMPOSE_PATH_SEPARATOR: ":",
    BACKUP_S3_BUCKET: "unused",
    BACKUP_S3_KEY: "unused",
    BACKUP_S3_KEY_SECRET: "unused",
    BETTER_AUTH_URL: "http://localhost",
    BETTER_AUTH_SECRET: "end-to-end-tests-only-not-a-real-secret",
    APP_HOST: "localhost",
  };
  // restore.sh sets COMPOSE_FILE itself, the same way.
  const files = ["-f", "compose.yaml", "-f", "compose.prod.yaml", "-f", "compose.override.yaml"];
  const compose = (args: string[], options?: { capture?: boolean; check?: boolean }) =>
    run("docker", ["compose", ...files, ...args], app, env, options);
  const psql = (sql: string) =>
    compose(["exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "web", "-tAc", sql], {
      capture: true,
    }).output.trim();
  // Over TCP: the entrypoint's first, setup-only server listens on the socket alone.
  const ready = () =>
    compose(["exec", "-T", "postgres", "pg_isready", "-q", "-h", "127.0.0.1"], { check: false }).ok;
  try {
    compose(["config", "--quiet"]);
    compose(["up", "-d", "--build", "postgres"]);
    waitFor("Postgres", ready);
    psql("CREATE TABLE e2e_restore (note text); INSERT INTO e2e_restore VALUES ('kept')");

    compose(["up", "-d", "backup"]);
    waitFor("the first backup", () => {
      const info = compose(
        ["exec", "-T", "backup", "pgbackrest", "--stanza=main", "--output=json", "info"],
        { capture: true, check: false },
      );
      return info.ok && info.output.includes('"type":"full"');
    });

    compose(["stop", "backup", "postgres"]);
    // As a lost volume leaves it: the image's empty PGDATA.
    const asPostgres = ["run", "--rm", "--no-deps", "--user", "postgres", "--entrypoint", "sh"];
    compose([...asPostgres, "postgres", "-c", 'find "$PGDATA" -mindepth 1 -delete']);
    run("sh", ["scripts/restore.sh", "--yes"], app, env);
    waitFor("Postgres after the restore", ready);
    const note = psql("SELECT note FROM e2e_restore");
    if (note !== "kept") throw new Error(`The restored database has "${note}", not "kept"`);
  } finally {
    compose(["down", "--volumes", "--remove-orphans"], { check: false });
  }
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
    // AGENTS.md's Skill Loading block is a copy of what Intent writes. Once oxfmt has been over
    // the repo, Intent's installer still finds it current, so a new Intent wording fails here.
    const agents = path.join(repo, "AGENTS.md");
    const scaffolded = lines(agents);
    sh("pnpm", ["exec", "intent", "install"], repo);
    if (lines(agents) !== scaffolded)
      throw new Error(
        "Intent rewrote AGENTS.md's Skill Loading block: copy what `intent install` wrote into templates/repo/root/AGENTS.md (and the root's)",
      );
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

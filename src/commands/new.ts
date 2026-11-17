import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import * as p from "@clack/prompts";

import { Overlay } from "../compose/overlay.ts";
import { capture, run } from "../exec.ts";
import type { StackId, StacksFile } from "../model.ts";
import {
  composeApp,
  ensurePnpm,
  githubOwner,
  kebab,
  loadVersions,
  makeApp,
  parseVersionsMode,
  progress,
  runPost,
  STACKS_FILE,
  titleCase,
} from "../scaffold.ts";
import { isStackId, STACKS } from "../stacks.ts";

const HELP = `stacks new [dir] [options] — a new repo with its first app

Options:
  --stack <id>          ${Object.keys(STACKS).join(" | ")}
  --app <name>          The first app's folder name, under apps/ or packages/ (default: the
                        stack's, such as "web" or "cli")
  --package-name <n>    Its package name, such as @me/tool for a published package
                        (default: the folder name)
  --title <text>        The repo's title (default: from its folder name)
  --github <owner/repo> Where it lives on GitHub, for \`repository\` fields (default: your gh
                        login and the folder name)
  --deploy <target>     Where the app deploys (see \`stacks list\`)
  --with <a,b>          Add-ons (see \`stacks list\`)
  --accent <palette>    The Chakra palette for the accent colour (default: teal)
  --versions <mode>     known-good (default) | latest | bundled
  --versions-file <f>   Use this version snapshot
  --no-install          Write the files only
  --no-git              Don't make a git repo and first commit
  -y, --yes             Take the defaults for anything not given; never prompt
`;

function bail(value: unknown): asserts value is string | string[] {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(1);
  }
}

export async function newCommand(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      stack: { type: "string" },
      app: { type: "string" },
      "package-name": { type: "string" },
      title: { type: "string" },
      github: { type: "string" },
      deploy: { type: "string" },
      with: { type: "string" },
      accent: { type: "string" },
      versions: { type: "string" },
      "versions-file": { type: "string" },
      install: { type: "boolean", default: true },
      git: { type: "boolean", default: true },
      yes: { type: "boolean", short: "y" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  const interactive = !values.yes && process.stdin.isTTY;
  const versionsMode = parseVersionsMode(values.versions);

  p.intro("stacks new");
  const pnpmVersion = await ensurePnpm();

  let dir = positionals[0];
  if (!dir) {
    if (!interactive) throw new Error("Give the new repo's directory: stacks new <dir>");
    const answer = await p.text({ message: "Where should the repo go?", placeholder: "my-app" });
    bail(answer);
    dir = answer;
  }
  const root = path.resolve(dir);
  if (existsSync(root) && readdirSync(root).length > 0) throw new Error(`${root} isn't empty`);
  const repoName = kebab(path.basename(root));
  if (!repoName) throw new Error(`Can't make a package name from "${path.basename(root)}"`);

  let stackId = values.stack;
  if (!stackId) {
    if (!interactive)
      throw new Error(`Choose a stack with --stack: ${Object.keys(STACKS).join(", ")}`);
    const answer = await p.select({
      message: "Which stack is the first app?",
      options: Object.values(STACKS).map((stack) => ({
        value: stack.id,
        label: stack.id,
        hint: stack.summary,
      })),
    });
    bail(answer);
    stackId = answer;
  }
  if (!isStackId(stackId))
    throw new Error(`Unknown stack "${stackId}"; choose ${Object.keys(STACKS).join(", ")}`);
  const stack = STACKS[stackId as StackId];

  let appName = values.app;
  if (!appName && interactive) {
    const answer = await p.text({
      message: `Its folder name, under ${stack.kind === "package" ? "packages" : "apps"}/`,
      initialValue: stack.defaultAppName,
    });
    bail(answer);
    appName = answer;
  }
  appName = kebab(appName ?? stack.defaultAppName);

  let deploy = values.deploy;
  if (!deploy && interactive && Object.keys(stack.deploys).length > 1) {
    const answer = await p.select({
      message: "Where does it deploy?",
      initialValue: stack.defaultDeploy,
      options: Object.entries(stack.deploys).map(([id, target]) => ({
        value: id,
        label: id,
        hint: target.summary,
      })),
    });
    bail(answer);
    deploy = answer;
  }
  deploy ??= stack.defaultDeploy;

  let addons = values.with
    ?.split(",")
    .map((addon) => addon.trim())
    .filter(Boolean);
  if (!addons && interactive && Object.keys(stack.addons).length > 0) {
    const answer = await p.multiselect({
      message: "Add-ons",
      required: false,
      options: Object.entries(stack.addons).map(([id, addon]) => ({
        value: id,
        label: id,
        hint: addon.summary,
      })),
    });
    bail(answer);
    addons = answer;
  }

  const { snapshot, source } = await loadVersions(
    { mode: versionsMode, file: values["versions-file"] },
    (message) => p.log.warn(message),
  );
  p.log.info(`Versions: ${source}`);

  const title = values.title ?? titleCase(repoName);
  const empty: StacksFile = {
    version: 1,
    cli: "",
    repo: {
      name: repoName,
      title,
      scope: `@${repoName}`,
      accent: values.accent ?? "teal",
      github: values.github ?? `${githubOwner() ?? "OWNER"}/${repoName}`,
    },
    apps: [],
  };
  const app = makeApp(stack, [], {
    name: appName,
    // The first app is often the repo's reason for being, so it takes the repo's title.
    title: ["web", "cli"].includes(appName) ? title : undefined,
    deploy,
    addons: addons ?? [],
    packageName: values["package-name"],
  });

  const overlay = new Overlay(root);
  const { post, warnings, file } = await composeApp(overlay, empty, app, {
    versions: snapshot,
    today: new Date().toISOString().slice(0, 10),
    isNew: true,
  });
  overlay.writeJson(STACKS_FILE, file);
  await overlay.flush();
  p.log.success(`Wrote ${overlay.changed.length} files to ${root}`);
  if (file.repo.github.startsWith("OWNER/")) {
    p.log.warn(
      "Couldn't tell your GitHub login; set it with --github, or fix the repository fields.",
    );
  }
  for (const warning of warnings) p.log.warn(warning);

  const install = values.install !== false;
  await runPost(
    root,
    [
      ...post,
      { title: "Formatting", command: "pnpm", args: ["run", "format"], needsInstall: true },
    ],
    {
      install,
    },
  );

  if (values.git !== false) {
    const status = progress("Making the first commit");
    try {
      await run("git", ["init", "-b", "trunk"], { cwd: root });
      await run("git", ["add", "-A"], { cwd: root });
      await run("git", ["commit", "-m", "chore: scaffold with stacks", "--no-verify"], {
        cwd: root,
        env: { HUSKY: "0" },
      });
      status.done("Made the first commit on trunk");
    } catch (error) {
      status.fail("Couldn't make the first commit");
      p.log.warn(error instanceof Error ? error.message : String(error));
    }
  }

  const relative = path.relative(process.cwd(), root) || ".";
  const steps = [
    `cd ${relative}`,
    ...(install ? [] : ["pnpm install"]),
    app.devPort === undefined
      ? `pnpm --filter ${app.packageName} dev -- --help`
      : `pnpm --filter ${app.packageName} dev     # http://localhost:${app.devPort}`,
    ...(file.ui ? ["pnpm storybook"] : []),
    "pnpm skills        # the agent skills Intent can load",
  ];
  p.note(steps.join("\n"), "Next");
  p.outro(
    `pnpm ${pnpmVersion}, Node ${snapshot.node}. ${capture("git", ["--version"]) ? "" : "Install git to commit."}`.trim(),
  );
}

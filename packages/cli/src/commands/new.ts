import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import * as p from "@clack/prompts";

import { Overlay } from "../compose/overlay.ts";
import { capture, run } from "../exec.ts";
import type { StacksFile } from "../model.ts";
import {
  ACCENTS,
  answer,
  appNameProblem,
  confirmPlan,
  equivalentCommand,
  intro,
  isGithubRepo,
  isInteractive,
  isPackageName,
  promptAddons,
  promptConfirm,
  promptDeploy,
  promptStack,
  promptText,
  wasAsked,
} from "../prompts.ts";
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

In a terminal it asks for anything not given; elsewhere, or with --yes, it takes the defaults.

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

/** Why `dir` can't take a new repo, if it can't. */
function dirProblem(dir: string): string | undefined {
  if (!dir) return "Give it a directory.";
  const root = path.resolve(dir);
  if (existsSync(root) && (!statSync(root).isDirectory() || readdirSync(root).length > 0))
    return `${root} isn't an empty directory.`;
  if (!kebab(path.basename(root)))
    return `Can't make a package name from "${path.basename(root)}".`;
  return undefined;
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
      // No defaults: unset means "ask in a terminal, otherwise yes".
      install: { type: "boolean" },
      git: { type: "boolean" },
      yes: { type: "boolean", short: "y" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  const interactive = isInteractive(values.yes);
  const versionsMode = parseVersionsMode(values.versions);

  intro("stacks new");
  const pnpmVersion = await ensurePnpm();

  let dir = positionals[0];
  if (!dir) {
    if (!interactive) throw new Error("Give the new repo's directory: stacks new <dir>");
    dir = await promptText({
      message: "Where should the repo go?",
      placeholder: "my-app",
      validate: dirProblem,
    });
  }
  const problem = dirProblem(dir);
  if (problem) throw new Error(problem);
  const root = path.resolve(dir);
  const repoName = kebab(path.basename(root));

  let title = values.title;
  if (title === undefined && interactive) {
    title = await promptText({
      message: "The repo's title",
      initialValue: titleCase(repoName),
      validate: (value) => (value ? undefined : "Give it a title."),
    });
  }
  title ??= titleCase(repoName);

  let github = values.github;
  if (github === undefined) {
    const owner = githubOwner();
    if (interactive) {
      github = await promptText({
        message: "Where it lives on GitHub (owner/repo)",
        initialValue: owner ? `${owner}/${repoName}` : undefined,
        placeholder: `owner/${repoName}`,
        validate: (value) => (isGithubRepo(value) ? undefined : "Write it as owner/repo."),
      });
    } else github = `${owner ?? "OWNER"}/${repoName}`;
  }

  let stackId = values.stack;
  if (!stackId) {
    if (!interactive)
      throw new Error(`Choose a stack with --stack: ${Object.keys(STACKS).join(", ")}`);
    stackId = (await promptStack("Which stack is the first app?")).id;
  }
  if (!isStackId(stackId))
    throw new Error(`Unknown stack "${stackId}"; choose ${Object.keys(STACKS).join(", ")}`);
  const stack = STACKS[stackId];

  let appName = values.app;
  if (!appName && interactive) {
    appName = await promptText({
      message: `Its folder name, under ${stack.kind === "package" ? "packages" : "apps"}/`,
      initialValue: stack.defaultAppName,
      validate: (value) => appNameProblem(value, stack),
    });
  }
  appName = kebab(appName ?? stack.defaultAppName);

  let packageName = values["package-name"];
  if (packageName === undefined && interactive && stack.kind === "package") {
    packageName = await promptText({
      message: "Its package name on npm",
      initialValue: appName,
      validate: (value) => (isPackageName(value) ? undefined : "That isn't a valid npm name."),
    });
    if (packageName === appName) packageName = undefined;
  }

  let deploy = values.deploy;
  if (!deploy && interactive) deploy = await promptDeploy(stack);
  deploy ??= stack.defaultDeploy;

  let addons = values.with
    ?.split(",")
    .map((addon) => addon.trim())
    .filter(Boolean);
  if (!addons && interactive) addons = await promptAddons(stack, deploy, []);
  addons ??= [];

  let accent = values.accent;
  if (accent === undefined && interactive && stack.needsUi) {
    accent = answer(
      await p.select({
        message: "The accent colour, a Chakra palette",
        initialValue: "teal",
        options: ACCENTS.map((palette) => ({ value: palette, label: palette })),
      }),
    );
  }
  accent ??= "teal";

  const install =
    values.install ?? (interactive ? await promptConfirm("Install dependencies?") : true);
  const git =
    values.git ??
    (interactive ? await promptConfirm("Make a git repo with a first commit?") : true);

  if (wasAsked()) {
    const command = equivalentCommand(["stacks", "new", dir], {
      stack: stack.id,
      app: appName,
      "package-name": packageName,
      title,
      github,
      deploy,
      with: addons,
      accent: stack.needsUi ? accent : undefined,
      versions: values.versions,
      "versions-file": values["versions-file"],
      install: install ? undefined : false,
      git: git ? undefined : false,
      yes: true,
    });
    const folder = `${stack.kind === "package" ? "packages" : "apps"}/${appName}`;
    const summary: [string, string][] = [
      ["Repo", `${path.relative(process.cwd(), root) || "."}: ${title}, ${github}`],
      [stack.kind === "package" ? "Package" : "App", `${folder}: ${stack.id} → ${deploy}`],
      ["Add-ons", addons.length > 0 ? addons.join(", ") : "none"],
    ];
    if (stack.needsUi) summary.push(["Accent", accent]);
    const then = [install && "install", git && "first commit"].filter(Boolean).join(", ");
    summary.push(["Then", then || "nothing"]);
    if (!(await confirmPlan(summary, command))) {
      p.cancel("Nothing written.");
      return;
    }
  }

  const { snapshot, source } = await loadVersions(
    { mode: versionsMode, file: values["versions-file"] },
    (message) => p.log.warn(message),
  );
  p.log.info(`Versions: ${source}`);

  const empty: StacksFile = {
    version: 1,
    cli: "",
    repo: {
      name: repoName,
      title,
      scope: `@${repoName}`,
      accent,
      github,
    },
    apps: [],
  };
  const app = makeApp(stack, [], {
    name: appName,
    // The first app is often the repo's reason for being, so it takes the repo's title.
    title: ["web", "cli"].includes(appName) ? title : undefined,
    deploy,
    addons,
    packageName,
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

  if (git) {
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

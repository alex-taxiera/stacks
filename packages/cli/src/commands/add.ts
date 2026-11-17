import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import * as p from "@clack/prompts";

import { Overlay } from "../compose/overlay.ts";
import {
  appNameProblem,
  confirmPlan,
  equivalentCommand,
  intro,
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
  findRoot,
  kebab,
  loadVersions,
  makeApp,
  parseVersionsMode,
  readStacksFile,
  runPost,
  STACKS_FILE,
  titleCase,
} from "../scaffold.ts";
import { isStackId, STACKS } from "../stacks.ts";

const HELP = `stacks add [stack] [name] [options] — add an app to the stacks repo you're in

In a terminal it asks for anything not given; elsewhere, or with --yes, it needs the stack and
name and takes the defaults for the rest.

Options:
  --title <text>        The app's title (default: from its name)
  --package-name <n>    Its package name, such as @me/tool for a published package
  --deploy <target>     Where the app deploys (see \`stacks list\`)
  --with <a,b>          Add-ons (see \`stacks list\`)
  --versions <mode>     known-good (default) | latest | bundled, for new catalog entries
  --versions-file <f>   Use this version snapshot
  --no-install          Write the files only
  --cwd <dir>           The repo's root (default: here)
  -y, --yes             Take the defaults for anything not given; never prompt
`;

export async function addCommand(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    allowNegative: true,
    options: {
      title: { type: "string" },
      "package-name": { type: "string" },
      deploy: { type: "string" },
      with: { type: "string" },
      versions: { type: "string" },
      "versions-file": { type: "string" },
      // No default: unset means "ask in a terminal, otherwise yes".
      install: { type: "boolean" },
      cwd: { type: "string" },
      yes: { type: "boolean", short: "y" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  const interactive = isInteractive(values.yes);
  const stackId = positionals[0];
  let rawName = positionals[1];
  if ((!stackId || !rawName) && !interactive)
    throw new Error(`Usage: stacks add <stack> <name>\n\n${HELP}`);
  if (stackId && !isStackId(stackId))
    throw new Error(`Unknown stack "${stackId}"; choose ${Object.keys(STACKS).join(", ")}`);

  const root = findRoot(values.cwd ?? process.cwd());
  if (!root)
    throw new Error(
      `No ${STACKS_FILE} here or above; run this inside a repo made by \`stacks new\`.`,
    );
  const file = readStacksFile(root);
  const taken = (dir: string) =>
    file.apps.some((app) => app.dir === dir) || existsSync(path.join(root, dir));

  if (interactive) intro("stacks add");
  const stack = stackId && isStackId(stackId) ? STACKS[stackId] : await promptStack("Which stack?");

  rawName ??= await promptText({
    message: `Its folder name, under ${stack.kind === "package" ? "packages" : "apps"}/`,
    initialValue: taken(`${stack.kind === "package" ? "packages" : "apps"}/${stack.defaultAppName}`)
      ? undefined
      : stack.defaultAppName,
    validate: (value) => appNameProblem(value, stack, taken),
  });

  let title = values.title;
  if (title === undefined && interactive) {
    const fallback = titleCase(kebab(rawName));
    title = await promptText({
      message: "Its title",
      initialValue: fallback,
      validate: (value) => (value ? undefined : "Give it a title."),
    });
    if (title === fallback) title = undefined;
  }

  let packageName = values["package-name"];
  if (packageName === undefined && interactive && stack.kind === "package") {
    const fallback = kebab(rawName);
    packageName = await promptText({
      message: "Its package name on npm",
      initialValue: fallback,
      validate: (value) => (isPackageName(value) ? undefined : "That isn't a valid npm name."),
    });
    if (packageName === fallback) packageName = undefined;
  }

  let deploy = values.deploy;
  if (!deploy && interactive) deploy = await promptDeploy(stack);

  let addons = values.with
    ?.split(",")
    .map((addon) => addon.trim())
    .filter(Boolean);
  if (!addons && interactive)
    addons = await promptAddons(stack, deploy ?? stack.defaultDeploy, file.apps);

  const app = makeApp(stack, file.apps, {
    name: rawName,
    title,
    deploy,
    addons,
    packageName,
  });
  if (existsSync(path.join(root, app.dir))) throw new Error(`${app.dir} already exists`);

  const install =
    values.install ?? (wasAsked() ? await promptConfirm("Install dependencies?") : true);

  if (wasAsked()) {
    const command = equivalentCommand(["pnpm", "stacks", "add", stack.id, app.name], {
      title,
      "package-name": packageName,
      deploy: app.deploy,
      with: app.addons,
      versions: values.versions,
      "versions-file": values["versions-file"],
      install: install ? undefined : false,
      yes: true,
    });
    const summary: [string, string][] = [
      [stack.kind === "package" ? "Package" : "App", `${app.dir}: ${stack.id} → ${app.deploy}`],
      ["Title", app.title],
      ["Add-ons", app.addons.length > 0 ? app.addons.join(", ") : "none"],
    ];
    if (app.packageName !== app.name) summary.push(["Package name", app.packageName]);
    if (app.devPort !== undefined) summary.push(["Dev port", String(app.devPort)]);
    summary.push(["Then", install ? "install" : "nothing"]);
    if (!(await confirmPlan(summary, command))) {
      p.cancel("Nothing written.");
      return;
    }
  }

  intro(`stacks add ${stack.id} ${app.name}`);
  await ensurePnpm();
  const { snapshot, source } = await loadVersions(
    { mode: parseVersionsMode(values.versions), file: values["versions-file"] },
    (message) => p.log.warn(message),
  );
  p.log.info(`Versions for new catalog entries: ${source}`);

  const overlay = new Overlay(root);
  const {
    post,
    warnings,
    file: next,
  } = await composeApp(overlay, file, app, {
    versions: snapshot,
    today: new Date().toISOString().slice(0, 10),
    isNew: false,
  });
  overlay.writeJson(STACKS_FILE, next);
  await overlay.flush();
  p.log.success(`Wrote or updated ${overlay.changed.length} files`);
  for (const warning of warnings) p.log.warn(warning);

  await runPost(
    root,
    [
      {
        title: "Installing dependencies",
        command: "pnpm",
        // pnpm turns on --frozen-lockfile when CI is set; adding an app always changes the lockfile.
        args: ["install", "--no-frozen-lockfile"],
      },
      ...post,
      { title: "Formatting", command: "pnpm", args: ["run", "format"], needsInstall: true },
    ],
    { install },
  );
  p.note(
    app.devPort === undefined
      ? `pnpm --filter ${app.packageName} dev -- --help`
      : `pnpm --filter ${app.packageName} dev     # http://localhost:${app.devPort}`,
    "Next",
  );
  p.outro(`Added ${app.dir}. Review the changes with git diff and commit them.`);
}

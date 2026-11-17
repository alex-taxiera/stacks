import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import * as p from "@clack/prompts";

import { Overlay } from "../compose/overlay.ts";
import {
  composeApp,
  ensurePnpm,
  loadVersions,
  makeApp,
  parseVersionsMode,
  readStacksFile,
  runPost,
  STACKS_FILE,
} from "../scaffold.ts";
import { isStackId, STACKS } from "../stacks.ts";

const HELP = `stacks add <stack> <name> [options] — add an app to the stacks repo you're in

Options:
  --title <text>        The app's title (default: from its name)
  --package-name <n>    Its package name, such as @me/tool for a published package
  --deploy <target>     Where the app deploys (see \`stacks list\`)
  --with <a,b>          Add-ons (see \`stacks list\`)
  --versions <mode>     known-good (default) | latest | bundled, for new catalog entries
  --versions-file <f>   Use this version snapshot
  --no-install          Write the files only
  --cwd <dir>           The repo's root (default: here)
`;

/** The nearest directory at or above `start` with a `.stacks.json`. */
function findRoot(start: string): string | undefined {
  let dir = path.resolve(start);
  while (true) {
    if (existsSync(path.join(dir, STACKS_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

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
      install: { type: "boolean", default: true },
      cwd: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  const [stackId, rawName] = positionals;
  if (!stackId || !rawName) throw new Error(`Usage: stacks add <stack> <name>\n\n${HELP}`);
  if (!isStackId(stackId))
    throw new Error(`Unknown stack "${stackId}"; choose ${Object.keys(STACKS).join(", ")}`);
  const stack = STACKS[stackId];

  const root = findRoot(values.cwd ?? process.cwd());
  if (!root)
    throw new Error(
      `No ${STACKS_FILE} here or above; run this inside a repo made by \`stacks new\`.`,
    );
  const file = readStacksFile(root);
  const app = makeApp(stack, file.apps, {
    name: rawName,
    title: values.title,
    deploy: values.deploy,
    addons: values.with
      ?.split(",")
      .map((addon) => addon.trim())
      .filter(Boolean),
    packageName: values["package-name"],
  });
  if (existsSync(path.join(root, app.dir))) throw new Error(`${app.dir} already exists`);

  p.intro(`stacks add ${stack.id} ${app.name}`);
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
      { title: "Installing dependencies", command: "pnpm", args: ["install"] },
      ...post,
      { title: "Formatting", command: "pnpm", args: ["run", "format"], needsInstall: true },
    ],
    { install: values.install !== false },
  );
  p.note(
    app.devPort === undefined
      ? `pnpm --filter ${app.packageName} dev -- --help`
      : `pnpm --filter ${app.packageName} dev     # http://localhost:${app.devPort}`,
    "Next",
  );
  p.outro(`Added ${app.dir}. Review the changes with git diff and commit them.`);
}

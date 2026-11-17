import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";

import * as p from "@clack/prompts";

import { Overlay } from "../compose/overlay.ts";
import { CLI_VERSION } from "../paths.ts";
import {
  findRoot,
  loadVersions,
  parseVersionsMode,
  readStacksFile,
  refreshManaged,
  STACKS_FILE,
  staleCatalogEntries,
} from "../scaffold.ts";

const HELP = `stacks update [options] — bring what stacks manages in this repo up to date

Rewrites AGENTS.md's stacks blocks and .agents/mcp.json's servers as this version of stacks
writes them, for every app in ${STACKS_FILE}. Your text outside the blocks, your own servers, and
every other file stay as they are. Reports catalog entries a major behind the known-good versions;
Dependabot (or you) moves those.

Options:
  --check               Change nothing; exit 1 if anything would change (for CI)
  --versions <mode>     known-good (default) | latest | bundled
  --versions-file <f>   Use this version snapshot
  --cwd <dir>           The repo's root (default: here)
`;

/** Whether `file` would change, comparing JSON by value so formatting alone doesn't count. */
function differs(root: string, file: string, next: string): boolean {
  const abs = path.join(root, file);
  if (!existsSync(abs)) return true;
  const current = readFileSync(abs, "utf8");
  if (!file.endsWith(".json")) return current.replaceAll("\r\n", "\n") !== next;
  return !isDeepStrictEqual(JSON.parse(current), JSON.parse(next));
}

export async function updateCommand(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      check: { type: "boolean" },
      versions: { type: "string" },
      "versions-file": { type: "string" },
      cwd: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  const root = findRoot(values.cwd ?? process.cwd());
  if (!root)
    throw new Error(
      `No ${STACKS_FILE} here or above; run this inside a repo made by \`stacks new\`.`,
    );
  const file = readStacksFile(root);

  p.intro(values.check ? "stacks update --check" : "stacks update");
  const { snapshot } = await loadVersions(
    { mode: parseVersionsMode(values.versions), file: values["versions-file"] },
    (message) => p.log.warn(message),
  );

  const overlay = new Overlay(root);
  refreshManaged(overlay, file, snapshot, new Date().toISOString().slice(0, 10));
  const changed = overlay.changed.filter((changedFile) =>
    differs(root, changedFile, overlay.read(changedFile) ?? ""),
  );
  for (const stale of staleCatalogEntries(overlay, snapshot)) p.log.warn(stale);

  if (values.check) {
    if (changed.length > 0) {
      p.log.error(`Out of date: ${changed.join(", ")}. Run \`stacks update\`.`);
      p.outro("Not up to date");
      process.exitCode = 1;
      return;
    }
    p.outro("Up to date");
    return;
  }
  if (changed.length === 0 && file.cli === CLI_VERSION) {
    p.outro("Already up to date");
    return;
  }
  // Only the files that differ, so a formatter's choices elsewhere survive.
  const writes = new Overlay(root);
  for (const changedFile of changed) writes.write(changedFile, overlay.read(changedFile) ?? "");
  writes.writeJson(STACKS_FILE, { ...file, cli: CLI_VERSION });
  await writes.flush();
  p.log.success(
    changed.length > 0 ? `Updated ${changed.join(", ")}` : `Recorded stacks ${CLI_VERSION}`,
  );
  p.outro("Run `pnpm run format`, review the changes with git diff, and commit them.");
}

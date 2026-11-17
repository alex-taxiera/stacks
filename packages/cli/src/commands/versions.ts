import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { allActions, allCrates, allImages, allPackages } from "../catalog.ts";
import { BUNDLED_VERSIONS_FILE } from "../paths.ts";
import { diffSnapshots, refreshSnapshot, type Change } from "../versions/resolve.ts";
import type { Snapshot } from "../versions/types.ts";
import { readBundledSnapshot, readPolicy, readSnapshot } from "../versions/snapshot.ts";

const HELP = `stacks versions — the known-good version snapshot

  stacks versions                     Summarise the bundled snapshot
  stacks versions refresh [options]   Resolve the newest allowed versions
  stacks versions apply <changes.json>...
                                      Apply changes a refresh printed with --json (the canary
                                      applies only the groups whose scaffolds passed)

Refresh options:
  --group <a,b>     Only these groups (see versions.policy.json; also node, pnpm, actions, docker, rust, misc)
  --from <file>     Start from this snapshot instead of the bundled one
  --write           Write the result to the bundled versions.json
  --out <file>      Write the result to another file
  --json            Print the changes as JSON, for the canary workflow
`;

export async function versionsCommand(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      group: { type: "string" },
      from: { type: "string" },
      write: { type: "boolean" },
      out: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }
  const [action] = positionals;
  const current = values.from ? await readSnapshot(values.from) : await readBundledSnapshot();

  if (!action) {
    console.log(`Snapshot from ${current.updated}: Node ${current.node}, pnpm ${current.pnpm}`);
    console.log(
      `${Object.keys(current.npm).length} npm packages, ${Object.keys(current.actions).length} actions`,
    );
    return;
  }
  if (action === "apply") {
    const files = positionals.slice(1);
    if (files.length === 0) throw new Error("Give the changes files to apply");
    const next: Snapshot = structuredClone(current);
    for (const file of files) {
      const { changes } = JSON.parse(await readFile(file, "utf8")) as { changes: Change[] };
      for (const change of changes) applyChange(next, change);
      console.log(`Applied ${changes.length} change(s) from ${file}`);
    }
    next.npm = Object.fromEntries(
      Object.entries(next.npm).toSorted(([a], [b]) => a.localeCompare(b)),
    );
    next.updated = new Date().toISOString().slice(0, 10);
    const text = `${JSON.stringify(next, null, 2)}
`;
    await writeFile(values.out ?? BUNDLED_VERSIONS_FILE, text);
    return;
  }
  if (action !== "refresh") throw new Error(`Unknown versions action "${action}"\n\n${HELP}`);

  const policy = await readPolicy();
  const groups =
    values.group
      ?.split(",")
      .map((group) => group.trim())
      .filter(Boolean) ?? [];
  const next = await refreshSnapshot(current, {
    packages: allPackages(),
    actions: await allActions(),
    images: await allImages(),
    crates: await allCrates(),
    policy,
    groups,
    onProgress: values.json ? undefined : (message) => console.error(`  ${message}`),
  });
  const changes = diffSnapshots(current, next, policy);

  if (values.json) {
    const changedGroups = [...new Set(changes.map((change) => change.group))].toSorted();
    console.log(JSON.stringify({ changes, groups: changedGroups }, null, 2));
  } else if (changes.length === 0) {
    console.log("Everything is current.");
  } else {
    for (const change of changes) {
      const flag = change.major ? " (major)" : "";
      console.log(
        `${change.group.padEnd(12)} ${change.name} ${change.from ?? "(new)"} → ${change.to}${flag}`,
      );
    }
  }

  const text = `${JSON.stringify(next, null, 2)}\n`;
  if (values.write) await writeFile(BUNDLED_VERSIONS_FILE, text);
  if (values.out) await writeFile(values.out, text);
}

function applyChange(snapshot: Snapshot, change: Change) {
  if (change.kind === "node") snapshot.node = change.to;
  else if (change.kind === "pnpm") snapshot.pnpm = change.to;
  else if (change.kind === "action") snapshot.actions[change.name] = change.to;
  else if (change.kind === "image") (snapshot.images ??= {})[change.name] = change.to;
  else if (change.kind === "crate") (snapshot.crates ??= {})[change.name] = change.to;
  else snapshot.npm[change.name] = change.to;
}

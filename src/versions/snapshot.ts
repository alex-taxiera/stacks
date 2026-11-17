import { readFile } from "node:fs/promises";

import semver from "semver";

import { BUNDLED_VERSIONS_FILE, CLI_VERSION, POLICY_FILE } from "../paths.ts";
import type { Fetch } from "./resolve.ts";
import type { Policy, Snapshot } from "./types.ts";

/**
 * Where `stacks new` reads the current known-good snapshot from: the repo's trunk, which the
 * nightly canary keeps fresh. An installed CLI therefore gets new versions without a release.
 */
export const REMOTE_VERSIONS_URL =
  process.env.STACKS_VERSIONS_URL ??
  "https://raw.githubusercontent.com/alex-taxiera/stacks/trunk/versions.json";

export type VersionsMode = "known-good" | "latest" | "bundled";

export async function readSnapshot(file: string): Promise<Snapshot> {
  const snapshot = JSON.parse(await readFile(file, "utf8")) as Snapshot;
  if (snapshot.schema !== 1)
    throw new Error(`${file}: unknown snapshot schema ${String(snapshot.schema)}`);
  return snapshot;
}

export async function readPolicy(): Promise<Policy> {
  return JSON.parse(await readFile(POLICY_FILE, "utf8")) as Policy;
}

export const readBundledSnapshot = () => readSnapshot(BUNDLED_VERSIONS_FILE);

/**
 * The remote snapshot when it's reachable, usable by this CLI and newer than the bundled one;
 * the bundled one otherwise. Never fails for want of a network.
 */
export async function loadKnownGood(
  options: { fetchFn?: Fetch; warn?: (message: string) => void } = {},
): Promise<{ snapshot: Snapshot; source: string }> {
  const { fetchFn = fetch, warn = () => {} } = options;
  const bundled = await readBundledSnapshot();
  try {
    const response = await fetchFn(REMOTE_VERSIONS_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const remote = (await response.json()) as Snapshot;
    if (remote.schema !== 1) throw new Error(`unknown schema ${String(remote.schema)}`);
    if (semver.lt(CLI_VERSION, remote.minCliVersion)) {
      warn(
        `The current known-good versions need stacks ${remote.minCliVersion} or newer (this is ${CLI_VERSION}); using the bundled ones from ${bundled.updated}. Run \`pnpm dlx @alex-taxiera/stacks@latest\` for the newest.`,
      );
      return { snapshot: bundled, source: `bundled (${bundled.updated})` };
    }
    if (remote.updated < bundled.updated)
      return { snapshot: bundled, source: `bundled (${bundled.updated})` };
    return { snapshot: remote, source: `known-good (${remote.updated})` };
  } catch (error) {
    warn(
      `Couldn't fetch the current known-good versions (${String(error)}); using the bundled ones from ${bundled.updated}.`,
    );
    return { snapshot: bundled, source: `bundled (${bundled.updated})` };
  }
}

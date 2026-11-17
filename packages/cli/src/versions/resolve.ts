import semver from "semver";

import type { PackagePolicy, Policy, Snapshot } from "./types.ts";

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const DAY_MS = 24 * 60 * 60 * 1000;

interface Packument {
  "dist-tags": Record<string, string>;
  versions: Record<string, { deprecated?: string }>;
  time: Record<string, string>;
}

async function getJson<T>(fetchFn: Fetch, url: string, headers: Record<string, string> = {}) {
  const response = await fetchFn(url, { headers: { accept: "application/json", ...headers } });
  if (!response.ok) throw new Error(`GET ${url}: ${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

/**
 * The newest version of `name` the policy allows: not deprecated, no newer than its dist-tag
 * (`latest` unless the policy names another), and published at least `minAgeDays` ago.
 */
export async function resolveNpm(
  name: string,
  options: {
    policy?: PackagePolicy;
    minAgeDays: number;
    nodeMajor: string;
    now?: Date;
    fetchFn?: Fetch;
  },
): Promise<string> {
  const { policy = {}, minAgeDays, nodeMajor, now = new Date(), fetchFn = fetch } = options;
  const doc = await getJson<Packument>(
    fetchFn,
    `https://registry.npmjs.org/${name.replace("/", "%2f")}`,
  );
  const tag = policy.tag ?? "latest";
  const ceiling = doc["dist-tags"][tag];
  if (!ceiling) throw new Error(`${name} has no "${tag}" dist-tag`);
  const range = policy.trackNode ? `^${nodeMajor}` : policy.range;
  const allowPrerelease = semver.prerelease(ceiling) !== null;
  const cutoff = now.getTime() - minAgeDays * DAY_MS;

  const candidates = Object.keys(doc.versions).filter((version) => {
    if (!semver.valid(version) || doc.versions[version]?.deprecated) return false;
    if (semver.prerelease(version) && !allowPrerelease) return false;
    if (semver.gt(version, ceiling)) return false;
    if (range && !semver.satisfies(version, range, { includePrerelease: allowPrerelease })) {
      return false;
    }
    const published = doc.time[version];
    return published !== undefined && Date.parse(published) <= cutoff;
  });
  const [newest] = semver.rsort(candidates);
  if (!newest) {
    throw new Error(
      `${name}: no version satisfies ${range ?? "*"} at or below ${tag} (${ceiling}) published ${minAgeDays}+ days ago`,
    );
  }
  return newest;
}

interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
}

/** The newest major tag (`v6`) of a GitHub Action whose release is at least `minAgeDays` old. */
export async function resolveAction(
  repo: string,
  options: { minAgeDays: number; now?: Date; fetchFn?: Fetch; token?: string },
): Promise<string> {
  const {
    minAgeDays,
    now = new Date(),
    fetchFn = fetch,
    token = process.env.GITHUB_TOKEN,
  } = options;
  const headers: Record<string, string> = { "x-github-api-version": "2022-11-28" };
  if (token) headers.authorization = `Bearer ${token}`;
  const releases = await getJson<GitHubRelease[]>(
    fetchFn,
    `https://api.github.com/repos/${repo}/releases?per_page=50`,
    headers,
  );
  const cutoff = now.getTime() - minAgeDays * DAY_MS;
  const majors = releases
    .filter((release) => !release.draft && !release.prerelease && release.published_at)
    .filter((release) => Date.parse(release.published_at ?? "") <= cutoff)
    .map((release) => semver.coerce(release.tag_name)?.major)
    .filter((major): major is number => major !== undefined);
  if (majors.length === 0) throw new Error(`${repo}: no release published ${minAgeDays}+ days ago`);
  return `v${Math.max(...majors)}`;
}

interface NodeRelease {
  version: string;
  lts: string | false;
}

/** The newest Node major with an LTS release. */
export async function resolveNodeLts(fetchFn: Fetch = fetch): Promise<string> {
  const releases = await getJson<NodeRelease[]>(fetchFn, "https://nodejs.org/dist/index.json");
  const majors = releases
    .filter((release) => release.lts !== false)
    .map((release) => semver.major(release.version));
  if (majors.length === 0) throw new Error("nodejs.org lists no LTS release");
  return String(Math.max(...majors));
}

/** Which policy group a package belongs to. */
export function groupOf(name: string, policy: Policy): string {
  for (const [group, patterns] of Object.entries(policy.groups)) {
    const matches = patterns.some((pattern) =>
      pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern,
    );
    if (matches) return group;
  }
  return "misc";
}

/** Runs `task` over `items`, at most `limit` at a time. */
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface RefreshOptions {
  /** Every npm package and GitHub Action the layers and templates use. */
  packages: string[];
  actions: string[];
  policy: Policy;
  /** Only refresh these groups (all when empty). `node`, `pnpm` and `actions` are groups too. */
  groups?: string[];
  fetchFn?: Fetch;
  now?: Date;
  onProgress?: (message: string) => void;
}

/** A snapshot with the newest allowed versions, starting from `current`. */
export async function refreshSnapshot(
  current: Snapshot,
  options: RefreshOptions,
): Promise<Snapshot> {
  const { policy, groups = [], fetchFn = fetch, now = new Date(), onProgress = () => {} } = options;
  const wants = (group: string) => groups.length === 0 || groups.includes(group);
  const minAgeDays = policy.minReleaseAgeDays;
  const next: Snapshot = structuredClone(current);

  if (wants("node")) {
    next.node = policy.node?.major ?? (await resolveNodeLts(fetchFn));
    onProgress(`node ${next.node}`);
  }
  if (wants("pnpm")) {
    next.pnpm = await resolveNpm("pnpm", {
      policy: policy.packages.pnpm,
      minAgeDays,
      nodeMajor: next.node,
      now,
      fetchFn,
    });
    onProgress(`pnpm ${next.pnpm}`);
  }

  const packages = options.packages.filter((name) => wants(groupOf(name, policy)));
  const versions = await mapLimit(packages, 8, async (name) => {
    const version = await resolveNpm(name, {
      policy: policy.packages[name],
      minAgeDays,
      nodeMajor: next.node,
      now,
      fetchFn,
    });
    onProgress(`${name} ${version}`);
    return version;
  });
  packages.forEach((name, index) => {
    next.npm[name] = versions[index] as string;
  });

  if (wants("actions")) {
    const tags = await mapLimit(options.actions, 4, (repo) =>
      resolveAction(repo, { minAgeDays, now, fetchFn }),
    );
    options.actions.forEach((repo, index) => {
      next.actions[repo] = tags[index] as string;
    });
  }

  // Drop what nothing uses any more, and keep the files' order stable for diffs.
  const used = new Set(options.packages);
  next.npm = Object.fromEntries(
    Object.entries(next.npm)
      .filter(([name]) => used.has(name))
      .toSorted(([a], [b]) => a.localeCompare(b)),
  );
  const usedActions = new Set(options.actions);
  next.actions = Object.fromEntries(
    Object.entries(next.actions)
      .filter(([repo]) => usedActions.has(repo))
      .toSorted(([a], [b]) => a.localeCompare(b)),
  );
  next.updated = now.toISOString().slice(0, 10);
  return next;
}

export interface Change {
  kind: "npm" | "action" | "node" | "pnpm";
  name: string;
  from?: string;
  to: string;
  group: string;
  major: boolean;
}

/** Whether `a` → `b` is a breaking bump. */
function isMajor(a: string | undefined, b: string): boolean {
  if (a === undefined) return false;
  const left = semver.coerce(a);
  const right = semver.coerce(b);
  if (!left || !right) return a !== b;
  // 0.x minors break like majors do.
  if (left.major === 0 && right.major === 0) return left.minor !== right.minor;
  return left.major !== right.major;
}

/** What differs between two snapshots, and whether each change is a major bump. */
export function diffSnapshots(from: Snapshot, to: Snapshot, policy: Policy): Change[] {
  const changes: Change[] = [];
  if (from.node !== to.node) {
    changes.push({
      kind: "node",
      name: "node",
      from: from.node,
      to: to.node,
      group: "node",
      major: true,
    });
  }
  if (from.pnpm !== to.pnpm) {
    changes.push({
      kind: "pnpm",
      name: "pnpm",
      from: from.pnpm,
      to: to.pnpm,
      group: "pnpm",
      major: isMajor(from.pnpm, to.pnpm),
    });
  }
  for (const [name, version] of Object.entries(to.npm)) {
    const previous = from.npm[name];
    if (previous === version) continue;
    changes.push({
      kind: "npm",
      name,
      from: previous,
      to: version,
      group: groupOf(name, policy),
      major: isMajor(previous, version),
    });
  }
  for (const [repo, tag] of Object.entries(to.actions)) {
    const previous = from.actions[repo];
    if (previous === tag) continue;
    changes.push({
      kind: "action",
      name: repo,
      from: previous,
      to: tag,
      group: "actions",
      major: previous !== undefined,
    });
  }
  return changes;
}

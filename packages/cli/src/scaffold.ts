import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";
import semver from "semver";

import { applyLayers, type ApplyResult } from "./compose/apply.ts";
import { upsertBlock } from "./compose/merge.ts";
import { Overlay } from "./compose/overlay.ts";
import { leftoverTokens } from "./compose/tokens.ts";
import { capture, run } from "./exec.ts";
import type { AppInfo, Ctx, Layer, McpServer, PostStep, StacksFile, UiInfo } from "./model.ts";
import { CLI_VERSION } from "./paths.ts";
import {
  appLayers,
  REPO_LAYERS,
  RUST_LAYER,
  STACKS,
  type StackDefinition,
  UI_LAYER,
} from "./stacks.ts";
import {
  loadKnownGood,
  readBundledSnapshot,
  readSnapshot,
  type VersionsMode,
} from "./versions/snapshot.ts";
import { refreshSnapshot } from "./versions/resolve.ts";
import { readPolicy } from "./versions/snapshot.ts";
import { allActions, allCrates, allImages, allPackages } from "./catalog.ts";
import type { Snapshot } from "./versions/types.ts";

export const STACKS_FILE = ".stacks.json";

/** Lower-case kebab, which a folder, a package name and a Worker name all accept. */
export function kebab(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** `my-cool-app` → `My Cool App`. */
export function titleCase(name: string): string {
  return name
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

/** Port 6008 is the UI package's Storybook, whether or not the repo has one yet. */
export const UI_STORYBOOK_PORT = 6008;

/** The next app's ports: dev servers ten apart from 3000, Storybooks one apart after the library's. */
export function nextPorts(apps: AppInfo[]): { devPort: number; storybookPort: number } {
  const devPorts = apps.flatMap((app) => (app.devPort === undefined ? [] : [app.devPort]));
  const storybookPorts = apps.flatMap((app) =>
    app.storybookPort === undefined ? [] : [app.storybookPort],
  );
  return {
    devPort: devPorts.length === 0 ? 3000 : Math.max(...devPorts) + 10,
    storybookPort: Math.max(UI_STORYBOOK_PORT, ...storybookPorts) + 1,
  };
}

export interface AppOptions {
  name: string;
  title?: string;
  deploy?: string;
  addons?: string[];
  packageName?: string;
}

/** The new app's details, placed beside the repo's existing ones. */
export function makeApp(stack: StackDefinition, existing: AppInfo[], options: AppOptions): AppInfo {
  const name = kebab(options.name);
  if (!name) throw new Error(`Can't make a folder name from "${options.name}"`);
  const dir = `${stack.kind === "package" ? "packages" : "apps"}/${name}`;
  if (existing.some((app) => app.dir === dir) || name === "ui")
    throw new Error(`${dir} already exists`);
  return {
    name,
    title: options.title ?? titleCase(name),
    stack: stack.id,
    kind: stack.kind,
    dir,
    packageName: options.packageName ?? name,
    deploy: options.deploy ?? stack.defaultDeploy,
    addons: options.addons ?? [],
    ...(stack.ports ? nextPorts(existing) : {}),
  };
}

interface LegacyStacksFile {
  repo: StacksFile["repo"] & { uiPackage?: string };
  ui?: Partial<UiInfo>;
  apps: (Omit<AppInfo, "kind" | "dir" | "packageName"> & Partial<AppInfo>)[];
}

/** The nearest directory at or above `start` with a `.stacks.json`. */
export function findRoot(start: string): string | undefined {
  let dir = path.resolve(start);
  while (true) {
    if (existsSync(path.join(dir, STACKS_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Every layer the repo was made from, with the context each ran in, in the order they ran. */
function layersOf(file: StacksFile, versions: Snapshot, today: string): [Ctx, Layer[]][] {
  const base: Ctx = { repo: file.repo, ui: file.ui, apps: file.apps, versions, today };
  const runs: [Ctx, Layer[]][] = [[base, REPO_LAYERS]];
  if (file.ui) runs.push([base, [UI_LAYER]]);
  // The first Rust app made the Cargo workspace, and its layer names that app.
  const rustApp = file.apps.find((app) => STACKS[app.stack].needsRust);
  if (rustApp) runs.push([{ ...base, app: rustApp }, [RUST_LAYER]]);
  for (const app of file.apps) runs.push([{ ...base, app }, appLayers(app)]);
  return runs;
}

/**
 * Rewrites what stacks manages in a repo it made, as the current layers say it: AGENTS.md's
 * blocks and `.agents/mcp.json`'s servers. It never touches a file the layers only created, and
 * leaves blocks and servers no layer names (yours, or an app's you removed) alone.
 */
export function refreshManaged(
  overlay: Overlay,
  file: StacksFile,
  versions: Snapshot,
  today: string,
) {
  let markdown = overlay.read("AGENTS.md");
  if (markdown === undefined) throw new Error("AGENTS.md is missing; is this a stacks repo?");
  const mcp =
    overlay.readJson<{ mcpServers?: Record<string, McpServer> }>(".agents/mcp.json") ?? {};
  const servers = { ...mcp.mcpServers };
  for (const [ctx, layers] of layersOf(file, versions, today)) {
    for (const layer of layers) {
      const spec = layer(ctx);
      for (const block of spec.agents ?? [])
        markdown = upsertBlock(markdown, block.region, block.id, block.body);
      Object.assign(servers, spec.mcp);
    }
  }
  overlay.write("AGENTS.md", markdown);
  overlay.writeJson(".agents/mcp.json", { ...mcp, mcpServers: servers });
}

/** Catalog entries a major or more behind the snapshot's known-good version. */
export function staleCatalogEntries(overlay: Overlay, versions: Snapshot): string[] {
  const workspace = overlay.readYaml<{ catalog?: Record<string, string> }>("pnpm-workspace.yaml");
  const stale: string[] = [];
  for (const [name, range] of Object.entries(workspace?.catalog ?? {})) {
    const known = versions.npm[name];
    const floor = known ? semver.minVersion(range) : null;
    if (known && floor && semver.major(known) > semver.major(floor))
      stale.push(`${name}: the catalog has ${range}; the known-good version is ${known}`);
  }
  return stale;
}

/** Reads `.stacks.json`, including the 0.1.0 shape, where every repo had a UI package. */
export function readStacksFile(root: string): StacksFile {
  const raw = JSON.parse(readFileSync(path.join(root, STACKS_FILE), "utf8")) as LegacyStacksFile &
    Pick<StacksFile, "version" | "cli">;
  const { uiPackage, ...repo } = raw.repo;
  const ui: UiInfo | undefined = raw.ui?.package
    ? { package: raw.ui.package, storybookPort: raw.ui.storybookPort ?? UI_STORYBOOK_PORT }
    : uiPackage
      ? { package: uiPackage, storybookPort: raw.ui?.storybookPort ?? UI_STORYBOOK_PORT }
      : undefined;
  return {
    version: 1,
    cli: raw.cli,
    repo: { ...repo, github: repo.github ?? `OWNER/${repo.name}` },
    ...(ui ? { ui } : {}),
    apps: raw.apps.map((app) => ({
      ...app,
      kind: app.kind ?? "app",
      dir: app.dir ?? `apps/${app.name}`,
      packageName: app.packageName ?? app.name,
    })),
  };
}

/** Your GitHub login, from gh or git config, for `repository` fields. */
export function githubOwner(): string | undefined {
  return (
    capture("gh", ["api", "user", "--jq", ".login"]) ?? capture("git", ["config", "github.user"])
  );
}

/** pnpm is required; corepack can provide it. */
export async function ensurePnpm(): Promise<string> {
  let version = capture("pnpm", ["--version"]);
  if (!version && capture("corepack", ["--version"])) {
    await run("corepack", ["enable", "pnpm"], { cwd: process.cwd() }).catch(() => undefined);
    version = capture("pnpm", ["--version"]);
  }
  if (!version) {
    throw new Error(
      "stacks needs pnpm. Install it with `corepack enable pnpm` (Node ships corepack) or https://pnpm.io/installation, then run this again.",
    );
  }
  return version;
}

export interface VersionOptions {
  mode: VersionsMode;
  file?: string;
}

export async function loadVersions(options: VersionOptions, warn: (message: string) => void) {
  if (options.file) return { snapshot: await readSnapshot(options.file), source: options.file };
  if (options.mode === "bundled") {
    const snapshot = await readBundledSnapshot();
    return { snapshot, source: `bundled (${snapshot.updated})` };
  }
  if (options.mode === "latest") {
    const bundled = await readBundledSnapshot();
    const snapshot: Snapshot = await refreshSnapshot(bundled, {
      packages: allPackages(),
      actions: await allActions(),
      images: await allImages(),
      crates: await allCrates(),
      policy: await readPolicy(),
    });
    return { snapshot, source: "latest (resolved now; untested together)" };
  }
  return loadKnownGood({ warn });
}

export function parseVersionsMode(value: string | undefined): VersionsMode {
  const mode = value ?? "known-good";
  if (mode !== "known-good" && mode !== "latest" && mode !== "bundled") {
    throw new Error(`--versions must be known-good, latest or bundled, not "${mode}"`);
  }
  return mode;
}

export interface ComposeResult {
  post: PostStep[];
  warnings: string[];
  /** The repo as `.stacks.json` should record it afterwards. */
  file: StacksFile;
}

/**
 * Applies an app's layers onto `overlay`: the repo's first when `isNew`, and the UI package's when
 * the app needs one and the repo has none yet.
 */
export async function composeApp(
  overlay: Overlay,
  file: StacksFile,
  app: AppInfo,
  options: { versions: Snapshot; today: string; isNew: boolean },
): Promise<ComposeResult> {
  const base: Omit<Ctx, "app"> = {
    repo: file.repo,
    ui: file.ui,
    apps: file.apps,
    versions: options.versions,
    today: options.today,
  };
  const results: ApplyResult[] = [];
  if (options.isNew) results.push(await applyLayers(overlay, base, REPO_LAYERS));
  if (STACKS[app.stack].needsUi && !base.ui) {
    base.ui = { package: `${file.repo.scope}/ui`, storybookPort: UI_STORYBOOK_PORT };
    results.push(await applyLayers(overlay, base, [UI_LAYER]));
  }
  if (STACKS[app.stack].needsRust && !overlay.exists("Cargo.toml")) {
    results.push(await applyLayers(overlay, { ...base, app }, [RUST_LAYER]));
  }
  results.push(await applyLayers(overlay, { ...base, app }, appLayers(app)));
  for (const changed of overlay.changed) {
    const left = leftoverTokens(overlay.read(changed) ?? "");
    if (left.length > 0)
      throw new Error(`${changed} still has template tokens: ${left.join(", ")}`);
  }
  return {
    post: results.flatMap((result) => result.post),
    warnings: results.flatMap((result) => result.warnings),
    file: {
      version: 1,
      cli: CLI_VERSION,
      repo: file.repo,
      ...(base.ui ? { ui: base.ui } : {}),
      apps: [...file.apps, app],
    },
  };
}

const keyOf = (step: PostStep) => `${step.command} ${step.args.join(" ")}`;

/**
 * A spinner in a terminal; a plain line per step anywhere else (CI, an agent's shell), where a
 * spinner's redraws would print as hundreds of lines.
 */
export function progress(title: string) {
  if (process.stdout.isTTY) {
    const spinner = p.spinner();
    spinner.start(title);
    return {
      done: (message = title) => spinner.stop(message),
      fail: (message: string) => spinner.error(message),
    };
  }
  p.log.step(title);
  return { done: () => {}, fail: (message: string) => p.log.error(message) };
}

/** Runs the post steps in order, skipping those that need an install when there wasn't one. */
export async function runPost(root: string, steps: PostStep[], options: { install: boolean }) {
  // A step two layers ask for runs once, at its last position: the agent sync after the skills
  // a later layer adds, say.
  const last = new Map(steps.map((step, index) => [keyOf(step), index]));
  for (const [index, step] of steps.entries()) {
    if (last.get(keyOf(step)) !== index) continue;
    const isInstall = step.command === "pnpm" && step.args[0] === "install";
    if ((isInstall || step.needsInstall) && !options.install) continue;
    const status = progress(step.title);
    try {
      await run(step.command, step.args, {
        cwd: step.cwd ? `${root}/${step.cwd}` : root,
        timeoutMs: step.timeoutMs,
      });
      status.done();
    } catch (error) {
      status.fail(`${step.title}: failed`);
      if (!step.optional) throw error;
      const message = error instanceof Error ? error.message : String(error);
      // The tail says why; the rest is the command's progress output.
      p.log.warn(message.split("\n").slice(-6).join("\n"));
      p.log.warn(`Run it again later with: ${step.command} ${step.args.join(" ")}`);
    }
  }
}

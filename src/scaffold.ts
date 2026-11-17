import * as p from "@clack/prompts";

import { applyLayers } from "./compose/apply.ts";
import { Overlay } from "./compose/overlay.ts";
import { leftoverTokens } from "./compose/tokens.ts";
import { capture, run } from "./exec.ts";
import type { AppInfo, Ctx, Layer, PostStep, StacksFile } from "./model.ts";
import { CLI_VERSION } from "./paths.ts";
import { appLayers } from "./stacks.ts";
import {
  loadKnownGood,
  readBundledSnapshot,
  readSnapshot,
  type VersionsMode,
} from "./versions/snapshot.ts";
import { refreshSnapshot } from "./versions/resolve.ts";
import { readPolicy } from "./versions/snapshot.ts";
import { allActions, allPackages } from "./catalog.ts";
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

/** The next app's ports: dev servers ten apart from 3000, Storybooks one apart after the library's. */
export function nextPorts(file: Pick<StacksFile, "apps" | "ui">): {
  devPort: number;
  storybookPort: number;
} {
  const devPorts = file.apps.map((app) => app.devPort);
  const storybookPorts = [file.ui.storybookPort, ...file.apps.map((app) => app.storybookPort)];
  return {
    devPort: devPorts.length === 0 ? 3000 : Math.max(...devPorts) + 10,
    storybookPort: Math.max(...storybookPorts) + 1,
  };
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

/** Applies the repo's layers (for `new`) and an app's onto `overlay`; returns the post steps. */
export async function composeApp(
  overlay: Overlay,
  base: Omit<Ctx, "app">,
  app: AppInfo,
  repoLayers: Layer[],
): Promise<{ post: PostStep[]; warnings: string[] }> {
  const repoResult = await applyLayers(overlay, base, repoLayers);
  const appResult = await applyLayers(overlay, { ...base, app }, appLayers(app));
  for (const file of overlay.changed) {
    const text = overlay.read(file) ?? "";
    const left = leftoverTokens(text);
    if (left.length > 0) throw new Error(`${file} still has template tokens: ${left.join(", ")}`);
  }
  return {
    post: [...repoResult.post, ...appResult.post],
    warnings: [...repoResult.warnings, ...appResult.warnings],
  };
}

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
  const seen = new Set<string>();
  for (const step of steps) {
    const key = `${step.command} ${step.args.join(" ")}`;
    if (seen.has(key)) continue;
    seen.add(key);
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

export function stacksFileFor(base: Omit<Ctx, "app">, apps: AppInfo[]): StacksFile {
  return { version: 1, cli: CLI_VERSION, repo: base.repo, ui: base.ui, apps };
}

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { actionsIn } from "./compose/tokens.ts";
import type { AppInfo, Ctx, Layer } from "./model.ts";
import { TEMPLATES_DIR } from "./paths.ts";
import { appLayers, REPO_LAYERS, STACKS } from "./stacks.ts";
import type { Snapshot } from "./versions/types.ts";

/** A context every layer can be evaluated in, to list what it asks for. */
function sampleCtx(app?: AppInfo): Ctx {
  const versions: Snapshot = {
    schema: 1,
    minCliVersion: "0.0.0",
    updated: "",
    node: "24",
    pnpm: "12.0.0",
    npm: {},
    actions: {},
  };
  return {
    repo: {
      name: "sample",
      title: "Sample",
      scope: "@sample",
      uiPackage: "@sample/ui",
      accent: "teal",
    },
    ui: { storybookPort: 6008 },
    versions,
    today: "2026-01-01",
    app,
  };
}

/** Every npm package any stack, deploy target or add-on can ask for. */
export function allPackages(): string[] {
  const names = new Set<string>();
  const collect = (layers: Layer[], ctx: Ctx) => {
    for (const layer of layers) {
      for (const part of Object.values(layer(ctx).packages ?? {})) {
        for (const name of [
          ...(part.dependencies ?? []),
          ...(part.devDependencies ?? []),
          ...(part.peerDependencies ?? []),
        ]) {
          names.add(name);
        }
      }
    }
  };
  collect(REPO_LAYERS, sampleCtx());
  for (const stack of Object.values(STACKS)) {
    for (const deploy of Object.keys(stack.deploys)) {
      const app: AppInfo = {
        name: "sample-app",
        title: "Sample app",
        stack: stack.id,
        deploy,
        addons: Object.keys(stack.addons),
        devPort: 3000,
        storybookPort: 6009,
      };
      collect(appLayers(app), sampleCtx(app));
    }
  }
  return [...names].toSorted();
}

/** Every GitHub Action a template names with `__ACTION[owner/repo]__`. */
export async function allActions(): Promise<string[]> {
  const repos = new Set<string>();
  const visit = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (/\.ya?ml$/.test(entry.name))
        for (const repo of actionsIn(await readFile(full, "utf8"))) repos.add(repo);
    }
  };
  await visit(TEMPLATES_DIR);
  return [...repos].toSorted();
}

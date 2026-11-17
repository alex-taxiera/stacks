import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { actionsIn, cratesIn, imagesIn } from "./compose/tokens.ts";
import type { AppInfo, Ctx, Layer, LayerSpec } from "./model.ts";
import { TEMPLATES_DIR } from "./paths.ts";
import { makeApp } from "./scaffold.ts";
import { appLayers, REPO_LAYERS, RUST_LAYER, STACKS, UI_LAYER } from "./stacks.ts";
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
    images: {},
    crates: {},
  };
  return {
    repo: {
      name: "sample",
      title: "Sample",
      scope: "@sample",
      accent: "teal",
      github: "me/sample",
    },
    ui: { package: "@sample/ui", storybookPort: 6008 },
    versions,
    today: "2026-01-01",
    app,
  };
}

/** What every layer asks for, evaluated for every stack, deploy target and add-on. */
function allSpecs(): LayerSpec[] {
  const specs: LayerSpec[] = [];
  const collect = (layers: Layer[], ctx: Ctx) => {
    for (const layer of layers) specs.push(layer(ctx));
  };
  collect([...REPO_LAYERS, UI_LAYER], sampleCtx());
  for (const stack of Object.values(STACKS)) {
    for (const deploy of Object.keys(stack.deploys)) {
      const app = makeApp(stack, [], {
        name: "sample-app",
        deploy,
        addons: Object.keys(stack.addons),
      });
      collect([...(stack.needsRust ? [RUST_LAYER] : []), ...appLayers(app)], sampleCtx(app));
    }
  }
  return specs;
}

/** Every npm package any stack, deploy target or add-on can ask for. */
export function allPackages(): string[] {
  const names = new Set<string>();
  for (const spec of allSpecs()) {
    for (const part of Object.values(spec.packages ?? {})) {
      for (const name of [
        ...(part.dependencies ?? []),
        ...(part.devDependencies ?? []),
        ...(part.peerDependencies ?? []),
      ]) {
        names.add(name);
      }
    }
  }
  return [...names].toSorted();
}

/** Every name `find` returns from any template's text, or any layer's patches. */
async function scanTemplates(find: (text: string) => string[]): Promise<string[]> {
  const names = new Set<string>();
  const visit = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(full);
      else for (const name of find(await readFile(full, "utf8"))) names.add(name);
    }
  };
  await visit(TEMPLATES_DIR);
  for (const spec of allSpecs()) {
    for (const name of find(JSON.stringify([spec.yaml, spec.json, spec.slots]))) names.add(name);
  }
  return [...names].toSorted();
}

/** Every GitHub Action a template names with `__ACTION[owner/repo]__`. */
export const allActions = () => scanTemplates(actionsIn);

/** Every Docker image a template names with `__IMAGE[name]__`. */
export const allImages = () => scanTemplates(imagesIn);

/** Every Rust crate a template names with `__CRATE[name]__`. */
export const allCrates = () => scanTemplates(cratesIn);

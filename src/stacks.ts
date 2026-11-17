import { deployCloudflareStatic, deployGhPages } from "./layers/deploy.ts";
import { repo } from "./layers/repo.ts";
import { spa } from "./layers/spa.ts";
import { ui } from "./layers/ui.ts";
import type { AppInfo, Layer, StackId } from "./model.ts";

export interface StackDefinition {
  id: StackId;
  summary: string;
  /** The name `new` suggests for the first app. */
  defaultAppName: string;
  deploys: Record<string, { summary: string; layer: Layer }>;
  defaultDeploy: string;
  addons: Record<string, { summary: string; layer: Layer }>;
  layers: Layer[];
}

export const REPO_LAYERS: Layer[] = [repo, ui];

export const STACKS: Record<StackId, StackDefinition> = {
  spa: {
    id: "spa",
    summary: "Client-only app: Vite, TanStack Router, every page prerendered to static HTML",
    defaultAppName: "web",
    deploys: {
      cloudflare: { summary: "Cloudflare Workers static assets", layer: deployCloudflareStatic },
      "gh-pages": { summary: "GitHub Pages", layer: deployGhPages },
    },
    defaultDeploy: "cloudflare",
    addons: {},
    layers: [spa],
  },
};

export const isStackId = (value: string): value is StackId => value in STACKS;

/** The layers that make one app, in order: the stack's, its deploy target's, then its add-ons'. */
export function appLayers(app: AppInfo): Layer[] {
  const stack = STACKS[app.stack];
  const deploy = stack.deploys[app.deploy];
  if (!deploy) {
    throw new Error(
      `${app.stack} can't deploy to "${app.deploy}"; choose ${Object.keys(stack.deploys).join(", ")}`,
    );
  }
  const addons = app.addons.map((id) => {
    const addon = stack.addons[id];
    if (!addon)
      throw new Error(
        `${app.stack} has no add-on "${id}"; choose from ${Object.keys(stack.addons).join(", ") || "none"}`,
      );
    return addon.layer;
  });
  return [...stack.layers, deploy.layer, ...addons];
}

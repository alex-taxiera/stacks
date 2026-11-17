import { addonE2e, addonSentry, addonZustand } from "./layers/addons.ts";
import { cli } from "./layers/cli.ts";
import {
  deployCloudflareSsr,
  deployCloudflareStatic,
  deployDocker,
  deployGhPages,
  releaseGithub,
  releaseNpm,
} from "./layers/deploy.ts";
import { repo } from "./layers/repo.ts";
import { spa } from "./layers/spa.ts";
import { astro } from "./layers/astro.ts";
import { start } from "./layers/start.ts";
import { addonUpdater, rust, tauri } from "./layers/tauri.ts";
import { ui } from "./layers/ui.ts";
import type { AppInfo, Layer, StackId } from "./model.ts";

export interface StackDefinition {
  id: StackId;
  summary: string;
  /** An app is deployed, from `apps/<name>`; a package is published, from `packages/<name>`. */
  kind: "app" | "package";
  /** Builds on `packages/ui`, which the first such app creates. */
  needsUi: boolean;
  /** Builds on the root Cargo workspace and `crates/core`, which the first such app creates. */
  needsRust?: boolean;
  /** Has a dev server and a Storybook, so gets ports. */
  ports: boolean;
  /** The name `new` suggests for the first app. */
  defaultAppName: string;
  deploys: Record<string, { summary: string; layer: Layer }>;
  defaultDeploy: string;
  addons: Record<string, { summary: string; layer: Layer }>;
  layers: Layer[];
}

const ZUSTAND = {
  summary: "Zustand for state shared between components",
  layer: addonZustand,
};

/** The add-ons the apps with a UI offer. */
const ADDONS: StackDefinition["addons"] = {
  e2e: { summary: "Playwright tests of whole flows in Chromium, with a CI job", layer: addonE2e },
  zustand: ZUSTAND,
  sentry: {
    summary: "Sentry for errors and performance, from the browser and a Docker server",
    layer: addonSentry,
  },
};

export const REPO_LAYERS: Layer[] = [repo];
export const UI_LAYER: Layer = ui;
export const RUST_LAYER: Layer = rust;

export const STACKS: Record<StackId, StackDefinition> = {
  spa: {
    id: "spa",
    summary: "Client-only app: Vite, TanStack Router, every page prerendered to static HTML",
    kind: "app",
    needsUi: true,
    ports: true,
    defaultAppName: "web",
    deploys: {
      cloudflare: { summary: "Cloudflare Workers static assets", layer: deployCloudflareStatic },
      "gh-pages": { summary: "GitHub Pages", layer: deployGhPages },
    },
    defaultDeploy: "cloudflare",
    addons: ADDONS,
    layers: [spa],
  },
  start: {
    id: "start",
    summary:
      "Fullstack app rendered on the server: TanStack Start, better-auth, Drizzle on Postgres",
    kind: "app",
    needsUi: true,
    ports: true,
    defaultAppName: "web",
    deploys: {
      docker: { summary: "Docker Compose on one server, behind Traefik", layer: deployDocker },
      cloudflare: {
        summary: "Cloudflare Workers, with Postgres through Hyperdrive",
        layer: deployCloudflareSsr,
      },
    },
    defaultDeploy: "docker",
    addons: ADDONS,
    layers: [start],
  },
  astro: {
    id: "astro",
    summary: "Site of pages: Astro, Markdown content, and React islands where a page needs them",
    kind: "app",
    needsUi: true,
    ports: true,
    defaultAppName: "site",
    deploys: {
      cloudflare: { summary: "Cloudflare Workers static assets", layer: deployCloudflareStatic },
      "gh-pages": { summary: "GitHub Pages", layer: deployGhPages },
    },
    defaultDeploy: "cloudflare",
    addons: {},
    layers: [astro],
  },
  tauri: {
    id: "tauri",
    summary: "Desktop app: Tauri 2 around a Vite, React and Chakra window, its commands in Rust",
    kind: "app",
    needsUi: true,
    needsRust: true,
    ports: true,
    defaultAppName: "desktop",
    deploys: {
      releases: {
        summary: "Installers for Windows, macOS and Linux on GitHub Releases",
        layer: releaseGithub,
      },
    },
    defaultDeploy: "releases",
    addons: {
      zustand: ZUSTAND,
      updater: {
        summary: "In-app updates from GitHub Releases, signed with a key kept out of the repo",
        layer: addonUpdater,
      },
    },
    layers: [tauri],
  },
  cli: {
    id: "cli",
    summary: "Command-line tool published to npm, shipping an agent skill through TanStack Intent",
    kind: "package",
    needsUi: false,
    ports: false,
    defaultAppName: "cli",
    deploys: {
      npm: { summary: "npm, with provenance, from a release workflow", layer: releaseNpm },
    },
    defaultDeploy: "npm",
    addons: {},
    layers: [cli],
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

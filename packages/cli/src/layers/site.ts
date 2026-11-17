import type { Layer, LayerSpec } from "../model.ts";
import { astroTypecheck } from "./astro.ts";
import { requireApp, requirePorts, requireUi } from "./require.ts";
import { spaTypecheck } from "./spa.ts";

/**
 * A Worker in front of a static site on Cloudflare, for `/api/*` routes: the pages are still
 * served without it, and only the paths in `run_worker_first` reach its code.
 */
export const addonWorker: Layer = (ctx): LayerSpec => {
  const app = requireApp(ctx.app);
  const { devPort } = requirePorts(app);
  const ui = requireUi(ctx).package;
  if (app.deploy !== "cloudflare") {
    throw new Error(
      `the worker add-on runs on Cloudflare Workers; deploy ${app.name} with --deploy cloudflare`,
    );
  }
  const typecheck = app.stack === "astro" ? astroTypecheck(ui) : spaTypecheck(ui);
  return {
    id: "addon-worker",
    packages: {
      app: {
        scripts: {
          // `Env` and the runtime's types, from wrangler.jsonc, into worker-configuration.d.ts.
          "cf-typegen": "wrangler types",
          "typecheck:worker": "wrangler types && tsc --noEmit -p worker",
          typecheck: `${typecheck} && pnpm run typecheck:worker`,
          // The built site with its Worker, as it's deployed.
          "preview:worker": `pnpm run build && wrangler dev --port ${devPort}`,
        },
      },
    },
    slots: {
      [`${app.dir}/wrangler.jsonc`]: {
        main: ['"main": "worker/index.ts",'],
        assets: [
          '"binding": "ASSETS",',
          "// Only these reach the Worker first; everything else is served straight from `dist`.",
          '"run_worker_first": ["/api/*"],',
        ],
      },
      [`${app.dir}/vite.config.ts`]: { "unit-tests": ['"worker/**/*.test.ts",'] },
    },
    json: {
      ".oxlintrc.json": { ignorePatterns: ["**/worker-configuration.d.ts"] },
    },
    lines: { ".gitignore": ["worker-configuration.d.ts"] },
    agents: [
      {
        region: "rules",
        id: `worker:${app.name}`,
        body: [
          `- **\`apps/${app.name}\`'s Worker runs only where it must.** Pages are served without it; a route`,
          `  that needs code goes in \`ROUTES\` in \`apps/${app.name}/worker/index.ts\` under a path that`,
          "  `run_worker_first` sends to it (`/api/*`), with a test in `worker/index.test.ts`. The Worker",
          "  runs on Cloudflare's runtime (no DOM, no Node) with its own tsconfig. Bindings and",
          "  variables go in `wrangler.jsonc`, secrets through `wrangler secret put <NAME>` from the",
          `  app's folder, never in the repo; run \`pnpm --filter ${app.name} cf-typegen\` after either`,
          "  so `Env` knows them. `preview:worker` serves the built site with its Worker.",
        ].join("\n"),
      },
    ],
  };
};

/**
 * A download page for the repo's desktop app: the latest release's installers, sorted by system,
 * with the visitor's own recommended. It reads GitHub's releases as the site is built and again in
 * the browser, and the site redeploys when the app publishes a release.
 */
export const addonDownloads: Layer = (ctx): LayerSpec => {
  const app = requireApp(ctx.app);
  // The first desktop app the repo made: the one a site of one product offers.
  const desktop = ctx.apps.find((other) => other.stack === "tauri");
  if (!desktop) throw new Error("the downloads add-on offers a desktop app; add a tauri app first");
  const tag = `${desktop.name}@v`;
  const workflow = app.deploy === "cloudflare" ? `deploy-${app.name}.yml` : `pages-${app.name}.yml`;
  const token = ["env:", "  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}"];
  return {
    id: "addon-downloads",
    slots: {
      [`${app.dir}/src/site-config.ts`]: {
        nav: ['{ href: "/download/", label: "Download" },'],
        config: [
          "",
          "/** The GitHub repository the desktop app is released from, as `owner/name`. */",
          `export const GITHUB_REPO = "${ctx.repo.github}";`,
          "",
          `/** The desktop app the download page offers. Its releases are tagged \`${tag}<version>\`. */`,
          `export const DESKTOP_APP = { name: "${desktop.name}", title: "${desktop.title}" } as const;`,
        ],
      },
      [`.github/workflows/${workflow}`]: {
        // A published release is new downloads: rebuild the page's snapshot of it.
        triggers: ["release:", "  types: [published]"],
        job: [
          "# Only for this app's releases, not another app's.",
          `if: github.event_name != 'release' || startsWith(github.event.release.tag_name, '${tag}')`,
        ],
        // A release's tag can be older than trunk; the site is always built from trunk, so
        // publishing a release never rolls it back.
        checkout: ["with:", "  ref: ${{ github.event_name == 'release' && 'trunk' || '' }}"],
        // The download page asks GitHub for the release as it's built; the token raises the rate
        // limit.
        "build-env": token,
      },
      ...(app.deploy === "cloudflare"
        ? { [`.github/workflows/preview-${app.name}.yml`]: { "build-env": token } }
        : {}),
    },
    agents: [
      {
        region: "rules",
        id: `downloads:${app.name}`,
        body: [
          `- **\`apps/${app.name}\`'s download page never names a file.** It offers \`apps/${desktop.name}\`'s newest`,
          `  published \`${tag}*\` release, which it asks GitHub for as the site is built and again in the`,
          "  browser. `src/downloads/artifacts.ts` sorts the release's files with a table of rules; a file",
          '  no rule knows is listed under "Other files", so a new kind shows up on its own. To give it a',
          "  label and a place on its system's tab, add a rule there and a case to `artifacts.test.ts`.",
          `  Never hard-code an asset name or version in a component. The site redeploys when a \`${tag}*\``,
          `  release is published (\`.github/workflows/${workflow}\`), always from \`trunk\`.`,
        ].join("\n"),
      },
    ],
  };
};

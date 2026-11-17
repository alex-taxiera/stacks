import type { Layer } from "../model.ts";

/** Static assets on Cloudflare Workers, deployed by a path-filtered workflow. */
export const deployCloudflareStatic: Layer = (ctx) => {
  const name = ctx.app?.name ?? "app";
  return {
    id: "deploy-cloudflare-static",
    packages: {
      app: {
        devDependencies: ["wrangler"],
        scripts: { deploy: "pnpm run build && wrangler deploy" },
      },
    },
    yaml: {
      // Wrangler's local runtime; only `wrangler dev` runs it, and the app only deploys.
      "pnpm-workspace.yaml": { allowBuilds: { workerd: false } },
    },
    lines: { ".gitignore": [".wrangler/"] },
    agents: [
      {
        region: "rules",
        id: `deploy:${name}`,
        body: `- **\`apps/${name}\` deploys to Cloudflare Workers** (static assets, \`wrangler.jsonc\`) from \`trunk\` through \`.github/workflows/deploy-${name}.yml\`, which needs the \`CLOUDFLARE_API_TOKEN\` and \`CLOUDFLARE_ACCOUNT_ID\` secrets.`,
      },
    ],
  };
};

/** GitHub Pages, deployed by a path-filtered workflow. */
export const deployGhPages: Layer = (ctx) => {
  const name = ctx.app?.name ?? "app";
  return {
    id: "deploy-gh-pages",
    agents: [
      {
        region: "rules",
        id: `deploy:${name}`,
        body: `- **\`apps/${name}\` deploys to GitHub Pages** from \`trunk\` through \`.github/workflows/pages-${name}.yml\`. It assumes a custom domain (served from \`/\`); without one, set Vite's \`base\` to \`/<repo>/\`.`,
      },
    ],
  };
};

/** npm, published with provenance from a dispatched release workflow. */
export const releaseNpm: Layer = (ctx) => {
  const name = ctx.app?.name ?? "cli";
  const pkg = ctx.app?.packageName ?? name;
  return {
    id: "release-npm",
    agents: [
      {
        region: "rules",
        id: `release:${name}`,
        body: [
          `- **\`${pkg}\` releases from \`.github/workflows/release-${name}.yml\`**: Actions → Run, pick a bump.`,
          `  It tags \`${name}@v<version>\`, sets the version in \`package.json\` and the skill's`,
          "  `library_version`, publishes to npm with provenance and makes a GitHub release. Never",
          "  edit `version` by hand. Publishing uses npm trusted publishing: add this repo and workflow",
          `  as a trusted publisher of \`${pkg}\` on npmjs.com once, before the first release.`,
        ].join("\n"),
      },
    ],
  };
};

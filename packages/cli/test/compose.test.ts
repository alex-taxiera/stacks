import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import { allActions, allImages, allPackages } from "../src/catalog.ts";
import { fillSlots } from "../src/compose/apply.ts";
import { Overlay } from "../src/compose/overlay.ts";
import type { AppInfo, StacksFile } from "../src/model.ts";
import { composeApp, makeApp, readStacksFile } from "../src/scaffold.ts";
import { STACKS } from "../src/stacks.ts";
import { readBundledSnapshot } from "../src/versions/snapshot.ts";
import type { Snapshot } from "../src/versions/types.ts";

let root: string;
let versions: Snapshot;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "stacks-test-"));
  versions = await readBundledSnapshot();
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const emptyRepo = (): StacksFile => ({
  version: 1,
  cli: "",
  repo: { name: "demo", title: "Demo", scope: "@demo", accent: "teal", github: "me/demo" },
  apps: [],
});

/** Composes `app` into the repo at `root` and writes it, as `new` (first) or `add` would. */
async function compose(file: StacksFile, app: AppInfo) {
  const overlay = new Overlay(root);
  const result = await composeApp(overlay, file, app, {
    versions,
    today: "2026-11-16",
    isNew: file.apps.length === 0,
  });
  overlay.writeJson(".stacks.json", result.file);
  await overlay.flush();
  return { overlay, ...result };
}

const read = (file: string) => readFile(path.join(root, file), "utf8");
const readJson = async <T>(file: string) => JSON.parse(await read(file)) as T;

const web = () => makeApp(STACKS.spa, [], { name: "web", deploy: "cloudflare" });
const startApp = (deploy: string, addons: string[] = []) =>
  makeApp(STACKS.start, [], { name: "web", deploy, addons });
const tool = () =>
  makeApp(STACKS.cli, [], { name: "cli", packageName: "@me/greeter", deploy: "npm" });

describe("the bundled snapshot", () => {
  it("has a version for every package, action and image the layers and templates use", async () => {
    expect(allPackages().filter((name) => !versions.npm[name])).toEqual([]);
    expect((await allActions()).filter((repo) => !versions.actions[repo])).toEqual([]);
    expect((await allImages()).filter((image) => !versions.images[image])).toEqual([]);
  });
});

describe("new --stack spa", () => {
  it("writes the repo, the UI package and the first app", async () => {
    const { overlay, file } = await compose(emptyRepo(), web());
    for (const expected of [
      "package.json",
      "pnpm-workspace.yaml",
      "AGENTS.md",
      ".agents/mcp.json",
      ".vscode/tasks.json",
      "packages/ui/package.json",
      "packages/ui/src/theme.ts",
      "apps/web/package.json",
      "apps/web/.storybook/main.ts",
      "apps/web/src/routes/__root.tsx",
      "apps/web/wrangler.jsonc",
      ".github/workflows/deploy-web.yml",
    ]) {
      expect(overlay.changed).toContain(expected);
    }
    expect(overlay.changed.some((changed) => /dot_|__[A-Z]/.test(changed))).toBe(false);
    expect(file.ui).toEqual({ package: "@demo/ui", storybookPort: 6008 });
    expect(file.apps[0]).toMatchObject({ dir: "apps/web", devPort: 3000, storybookPort: 6009 });
  });

  it("asks for every dependency through the catalog, and pins pnpm", async () => {
    await compose(emptyRepo(), web());
    const app = await readJson<{ dependencies: Record<string, string> }>("apps/web/package.json");
    expect(app.dependencies["@demo/ui"]).toBe("workspace:*");
    expect(app.dependencies.react).toBe("catalog:");
    const rootPackage = await readJson<{ packageManager: string; intent: { skills: string[] } }>(
      "package.json",
    );
    expect(rootPackage.packageManager).toBe(`pnpm@${versions.pnpm}`);
    expect(rootPackage.intent.skills).toEqual(["@tanstack/*"]);
    const workspace = parse(await read("pnpm-workspace.yaml")) as {
      packages: string[];
      catalog: Record<string, string>;
    };
    expect(workspace.packages).toEqual(["apps/*", "packages/*"]);
    expect(workspace.catalog.react).toBe(`^${versions.npm.react}`);
  });

  it("fills in tokens, including action versions", async () => {
    await compose(emptyRepo(), web());
    expect(await read(".github/workflows/ci.yml")).toContain(
      `actions/checkout@${versions.actions["actions/checkout"]}`,
    );
    expect(await read("apps/web/vite.config.ts")).toContain("port: 3000");
    expect(await read("apps/web/.storybook/preview.tsx")).toContain('from "@demo/ui/storybook"');
  });

  it("wires the UI package into the root: lint rule, MCP servers, AGENTS.md", async () => {
    await compose(emptyRepo(), web());
    const oxlint = await read(".oxlintrc.json");
    expect(oxlint).toContain("Use the snippet from @demo/ui");
    const mcp = await readJson<{ mcpServers: Record<string, { command?: string }> }>(
      ".agents/mcp.json",
    );
    expect(Object.keys(mcp.mcpServers)).toEqual(["chakra-ui", "storybook-ui", "storybook-web"]);
    expect(mcp.mcpServers["chakra-ui"]?.command).toBe("pnpm");
    const agents = await read("AGENTS.md");
    expect(agents).toContain("stacks:block:ui");
    expect(agents).toContain("### Accessibility");
  });
});

describe("new --stack cli", () => {
  it("puts the package in packages/ and makes no UI package", async () => {
    const { overlay, file } = await compose(emptyRepo(), tool());
    expect(file.ui).toBeUndefined();
    expect(file.apps[0]).toMatchObject({ kind: "package", dir: "packages/cli" });
    expect(file.apps[0]?.devPort).toBeUndefined();
    expect(overlay.changed.some((changed) => changed.startsWith("packages/ui/"))).toBe(false);
    expect(overlay.changed).toContain("packages/cli/skills/greeter/SKILL.md");
    expect(overlay.changed).toContain(".github/workflows/release-cli.yml");
    expect(await read(".oxlintrc.json")).not.toContain("no-restricted-imports");
    const mcp = await readJson<{ mcpServers: Record<string, unknown> }>(".agents/mcp.json");
    expect(mcp.mcpServers).toEqual({});
    expect(await read("AGENTS.md")).not.toContain("Chakra");
  });

  it("publishes the package with its skill, and the root consumes that skill", async () => {
    await compose(emptyRepo(), tool());
    const pkg = await readJson<{
      name: string;
      private?: boolean;
      bin: Record<string, string>;
      files: string[];
      keywords: string[];
      repository: { url: string; directory: string };
    }>("packages/cli/package.json");
    expect(pkg.name).toBe("@me/greeter");
    expect(pkg.private).toBeUndefined();
    expect(pkg.bin).toEqual({ greeter: "./dist/cli.js" });
    expect(pkg.files).toEqual(["dist", "skills"]);
    expect(pkg.keywords).toContain("tanstack-intent");
    expect(pkg.repository).toMatchObject({ directory: "packages/cli" });

    const rootPackage = await readJson<{
      devDependencies: Record<string, string>;
      intent: { skills: string[] };
    }>("package.json");
    expect(rootPackage.devDependencies["@me/greeter"]).toBe("workspace:*");
    expect(rootPackage.intent.skills).toEqual(["workspace:@me/greeter"]);

    const skill = await read("packages/cli/skills/greeter/SKILL.md");
    expect(skill).toContain(`library: "@me/greeter"`);
    expect(skill).toContain('- "packages/cli/src/cli.ts"');
  });
});

describe("add", () => {
  it("creates the UI package with the first app that needs it, once", async () => {
    const first = await compose(
      emptyRepo(),
      makeApp(STACKS.cli, [], { name: "cli", deploy: "npm" }),
    );
    const site = makeApp(STACKS.spa, first.file.apps, { name: "web", deploy: "gh-pages" });
    expect([site.devPort, site.storybookPort]).toEqual([3000, 6009]);
    const second = await compose(first.file, site);
    expect(second.file.ui?.package).toBe("@demo/ui");
    expect(second.overlay.changed).toContain("packages/ui/src/theme.ts");

    const docs = makeApp(STACKS.spa, second.file.apps, { name: "docs", deploy: "cloudflare" });
    expect([docs.devPort, docs.storybookPort]).toEqual([3010, 6010]);
    const third = await compose(second.file, docs);
    expect(third.overlay.changed.some((changed) => changed.startsWith("packages/ui/"))).toBe(false);

    const agents = await read("AGENTS.md");
    for (const block of ["app:cli", "ui", "app:web", "app:docs", "skill:cli"]) {
      expect(agents).toContain(`<!-- stacks:block:${block} -->`);
    }
    const mcp = await readJson<{ mcpServers: Record<string, unknown> }>(".agents/mcp.json");
    expect(Object.keys(mcp.mcpServers)).toEqual([
      "chakra-ui",
      "storybook-ui",
      "storybook-web",
      "storybook-docs",
    ]);
  });

  it("refuses a name that's taken", async () => {
    const { file } = await compose(emptyRepo(), makeApp(STACKS.spa, [], { name: "web" }));
    expect(() => makeApp(STACKS.spa, file.apps, { name: "web" })).toThrow(/already exists/);
    expect(() => makeApp(STACKS.cli, file.apps, { name: "ui" })).toThrow(/already exists/);
  });
});

describe("readStacksFile", () => {
  it("reads the 0.1.0 shape, where every repo had a UI package", async () => {
    await writeFile(
      path.join(root, ".stacks.json"),
      JSON.stringify({
        version: 1,
        cli: "0.1.0",
        repo: { name: "old", title: "Old", scope: "@old", uiPackage: "@old/ui", accent: "teal" },
        ui: { storybookPort: 6008 },
        apps: [
          {
            name: "web",
            title: "Old",
            stack: "spa",
            deploy: "cloudflare",
            addons: [],
            devPort: 3000,
            storybookPort: 6009,
          },
        ],
      }),
    );
    const file = readStacksFile(root);
    expect(file.ui).toEqual({ package: "@old/ui", storybookPort: 6008 });
    expect(file.repo).not.toHaveProperty("uiPackage");
    expect(file.apps[0]).toMatchObject({ kind: "app", dir: "apps/web", packageName: "web" });
  });
});

describe("new --stack start", () => {
  it("takes its database module from the deploy target", async () => {
    await compose(emptyRepo(), startApp("docker"));
    expect(await read("apps/web/src/db/index.ts")).toContain("closeDb");
    expect(await read("apps/web/compose.yaml")).toContain("target: migrate");
    expect(await read("apps/web/compose.yaml")).toContain(`postgres:${versions.images.postgres}`);
  });

  it("builds a Worker for Cloudflare, with Hyperdrive", async () => {
    await compose(emptyRepo(), startApp("cloudflare"));
    expect(await read("apps/web/src/db/index.ts")).toContain("HYPERDRIVE");
    expect(await read("apps/web/nitro.config.ts")).toContain('preset: "cloudflare-module"');
    expect(await read(".github/workflows/deploy-web.yml")).toContain("db:migrate");
  });

  it("adds Playwright and Zustand, with a CI job that brings Postgres", async () => {
    const { overlay } = await compose(emptyRepo(), startApp("docker", ["e2e", "zustand"]));
    expect(overlay.changed).toContain("apps/web/e2e/accounts.spec.ts");
    expect(overlay.changed).toContain("apps/web/src/stores/preferences.ts");
    const app = await readJson<{ scripts: Record<string, string>; dependencies: object }>(
      "apps/web/package.json",
    );
    expect(app.scripts.e2e).toBe("playwright test");
    expect(app.dependencies).toHaveProperty("zustand");
    const tsconfig = await readJson<{ include: string[] }>("apps/web/tsconfig.json");
    expect(tsconfig.include).toEqual(
      expect.arrayContaining(["src", "e2e", "playwright.config.ts"]),
    );
    const ci = parse(await read(".github/workflows/ci.yml")) as {
      jobs: Record<string, { services?: { postgres: { image: string } } }>;
    };
    expect(ci.jobs["e2e-web"]?.services?.postgres.image).toBe(
      `postgres:${versions.images.postgres}`,
    );
  });
});

describe("slots", () => {
  it("are filled by add-ons, and leave no marker behind when they aren't", async () => {
    const { overlay } = await compose(emptyRepo(), startApp("docker", ["sentry"]));
    const router = await read("apps/web/src/router.tsx");
    expect(router).toContain('import * as Sentry from "@sentry/tanstackstart-react";');
    expect(router).toContain("tanstackRouterBrowserTracingIntegration(router)");
    const dockerfile = await read("apps/web/Dockerfile");
    expect(dockerfile).toContain("FROM base AS sentry");
    expect(dockerfile).toContain('ENV NODE_OPTIONS="--import ./instrument.server.mjs"');
    const withMarkers: string[] = [];
    for (const file of overlay.changed) {
      if (/\.(png|ico|woff2?)$/.test(file)) continue;
      if ((await read(file)).includes("stacks:slot")) withMarkers.push(file);
    }
    expect(withMarkers).toEqual([]);
  });

  it("vanish from an app without add-ons", async () => {
    await compose(emptyRepo(), web());
    const main = await read("apps/web/src/main.tsx");
    expect(main).not.toContain("stacks:slot");
    expect(main).not.toContain("Sentry");
  });

  it("refuse a fill for a slot no file has", () => {
    const overlay = new Overlay(root);
    overlay.write("a.ts", "// stacks:slot here\n");
    expect(() =>
      fillSlots(overlay, [{ id: "x", slots: { "a.ts": { elsewhere: ["code()"] } } }]),
    ).toThrow('a.ts has no slot "elsewhere"');
  });
});

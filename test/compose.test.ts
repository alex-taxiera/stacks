import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import { allActions, allPackages } from "../src/catalog.ts";
import { Overlay } from "../src/compose/overlay.ts";
import type { AppInfo, Ctx } from "../src/model.ts";
import { composeApp, nextPorts, stacksFileFor } from "../src/scaffold.ts";
import { REPO_LAYERS } from "../src/stacks.ts";
import { readBundledSnapshot } from "../src/versions/snapshot.ts";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "stacks-test-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function baseCtx(): Promise<Omit<Ctx, "app">> {
  return {
    repo: { name: "demo", title: "Demo", scope: "@demo", uiPackage: "@demo/ui", accent: "teal" },
    ui: { storybookPort: 6008 },
    versions: await readBundledSnapshot(),
    today: "2026-11-16",
  };
}

const web: AppInfo = {
  name: "web",
  title: "Demo",
  stack: "spa",
  deploy: "cloudflare",
  addons: [],
  devPort: 3000,
  storybookPort: 6009,
};

describe("the bundled snapshot", () => {
  it("has a version for every package and action the layers and templates use", async () => {
    const snapshot = await readBundledSnapshot();
    expect(allPackages().filter((name) => !snapshot.npm[name])).toEqual([]);
    expect((await allActions()).filter((repo) => !snapshot.actions[repo])).toEqual([]);
  });
});

describe("new", () => {
  it("writes the repo, the UI package and the first app", async () => {
    const overlay = new Overlay(root);
    await composeApp(overlay, await baseCtx(), web, REPO_LAYERS);
    const files = overlay.changed;
    for (const file of [
      "package.json",
      "pnpm-workspace.yaml",
      "AGENTS.md",
      ".agents/mcp.json",
      ".gitignore",
      ".storybook/main.ts".replace(/^/, "apps/web/"),
      "packages/ui/package.json",
      "packages/ui/src/theme.ts",
      "apps/web/package.json",
      "apps/web/src/routes/__root.tsx",
      "apps/web/wrangler.jsonc",
      ".github/workflows/deploy-web.yml",
    ]) {
      expect(files).toContain(file);
    }
    expect(files.some((file) => file.includes("dot_") || file.includes("__APP"))).toBe(false);
  });

  it("asks for every dependency through the catalog, and pins pnpm", async () => {
    const overlay = new Overlay(root);
    const ctx = await baseCtx();
    await composeApp(overlay, ctx, web, REPO_LAYERS);
    const app = overlay.readJson<{ dependencies: Record<string, string> }>("apps/web/package.json");
    expect(app?.dependencies["@demo/ui"]).toBe("workspace:*");
    expect(app?.dependencies.react).toBe("catalog:");
    const rootPackage = overlay.readJson<{ packageManager: string }>("package.json");
    expect(rootPackage?.packageManager).toBe(`pnpm@${ctx.versions.pnpm}`);
    const workspace = parse(overlay.read("pnpm-workspace.yaml") ?? "") as {
      packages: string[];
      catalog: Record<string, string>;
    };
    expect(workspace.packages).toEqual(["apps/*", "packages/*"]);
    expect(workspace.catalog.react).toBe(`^${ctx.versions.npm.react}`);
  });

  it("fills in tokens, including action versions", async () => {
    const overlay = new Overlay(root);
    const ctx = await baseCtx();
    await composeApp(overlay, ctx, web, REPO_LAYERS);
    expect(overlay.read(".github/workflows/ci.yml")).toContain(
      `actions/checkout@${ctx.versions.actions["actions/checkout"]}`,
    );
    expect(overlay.read("apps/web/vite.config.ts")).toContain("port: 3000");
    expect(overlay.read("apps/web/.storybook/preview.tsx")).toContain('from "@demo/ui/storybook"');
  });
});

describe("add", () => {
  it("merges a second app into the repo's shared files", async () => {
    const ctx = await baseCtx();
    const first = new Overlay(root);
    await composeApp(first, ctx, web, REPO_LAYERS);
    first.writeJson(".stacks.json", stacksFileFor(ctx, [web]));
    await first.flush();

    const docs: AppInfo = {
      ...web,
      name: "docs",
      title: "Docs",
      deploy: "gh-pages",
      ...nextPorts({ apps: [web], ui: ctx.ui }),
    };
    expect([docs.devPort, docs.storybookPort]).toEqual([3010, 6010]);
    const second = new Overlay(root);
    await composeApp(second, ctx, docs, []);
    await second.flush();

    const agents = await readFile(path.join(root, "AGENTS.md"), "utf8");
    expect(agents).toContain("stacks:block:app:web");
    expect(agents).toContain("stacks:block:app:docs");
    const mcp = JSON.parse(await readFile(path.join(root, ".agents/mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(mcp.mcpServers)).toEqual([
      "chakra-ui",
      "storybook-ui",
      "storybook-web",
      "storybook-docs",
    ]);
    expect(second.changed).toContain(".github/workflows/pages-docs.yml");
    expect(second.changed).not.toContain("packages/ui/package.json");
  });

  it("refuses to overwrite an app's files", async () => {
    const ctx = await baseCtx();
    const first = new Overlay(root);
    await composeApp(first, ctx, web, REPO_LAYERS);
    await first.flush();
    await expect(composeApp(new Overlay(root), ctx, web, [])).rejects.toThrow(/already exists/);
  });
});

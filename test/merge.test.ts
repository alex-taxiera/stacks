import { describe, expect, it } from "vitest";

import { appendLines, deepMerge, upsertBlock } from "../src/compose/merge.ts";

describe("deepMerge", () => {
  it("merges objects deeply and unions arrays in order", () => {
    expect(
      deepMerge(
        { a: { b: 1, list: ["x", "y"] }, keep: true },
        { a: { c: 2, list: ["y", "z"] }, extra: "new" },
      ),
    ).toEqual({ a: { b: 1, c: 2, list: ["x", "y", "z"] }, keep: true, extra: "new" });
  });

  it("replaces scalars", () => {
    expect(deepMerge({ port: 1 }, { port: 2 })).toEqual({ port: 2 });
  });
});

const AGENTS = `# AGENTS.md

Hand-written intro.

<!-- stacks:apps:start -->
<!-- stacks:apps:end -->

More of the user's text.
`;

describe("upsertBlock", () => {
  it("appends a block to its region and keeps the text around it", () => {
    const once = upsertBlock(AGENTS, "apps", "app:web", "- web");
    expect(once).toContain("<!-- stacks:block:app:web -->\n- web\n<!-- /stacks:block:app:web -->");
    expect(once).toContain("Hand-written intro.");
    expect(once).toContain("More of the user's text.");
  });

  it("replaces a block that's already there instead of adding a second", () => {
    const once = upsertBlock(AGENTS, "apps", "app:web", "- web");
    const twice = upsertBlock(once, "apps", "app:web", "- web, renamed");
    expect(twice.match(/<!-- stacks:block:app:web -->/g)).toHaveLength(1);
    expect(twice).toContain("- web, renamed");
    expect(twice).not.toContain("- web\n");
  });

  it("orders blocks as they were added", () => {
    const both = upsertBlock(upsertBlock(AGENTS, "apps", "a", "- a"), "apps", "b", "- b");
    expect(both.indexOf("- a")).toBeLessThan(both.indexOf("- b"));
  });

  it("fails loudly when the region is missing", () => {
    expect(() => upsertBlock("# nothing", "apps", "x", "- x")).toThrow(/no <!-- stacks:apps:start/);
  });
});

describe("appendLines", () => {
  it("adds only the lines that are missing", () => {
    expect(appendLines("node_modules/\ndist/\n", ["dist/", ".wrangler/"])).toBe(
      "node_modules/\ndist/\n.wrangler/\n",
    );
  });
});

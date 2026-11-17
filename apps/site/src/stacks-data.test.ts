import { describe, expect, it } from "vitest";

import { addonRows, stackRows } from "./stacks-data";

describe("stackRows", () => {
  it("lists every stack the CLI has, with its default deploy marked", () => {
    const rows = stackRows();
    expect(rows.map((row) => row.id)).toEqual(["spa", "start", "astro", "tauri", "cli"]);
    const astro = rows.find((row) => row.id === "astro");
    expect(astro?.dir).toBe("apps/<name>");
    expect(astro?.deploys.filter((deploy) => deploy.isDefault).map((d) => d.id)).toEqual([
      "cloudflare",
    ]);
    expect(rows.find((row) => row.id === "cli")?.dir).toBe("packages/<name>");
  });
});

describe("addonRows", () => {
  it("lists each add-on once, with every stack that takes it and its limits", () => {
    const rows = addonRows();
    expect(rows.filter((row) => row.id === "worker")).toEqual([
      expect.objectContaining({ stacks: ["spa", "astro"], deploys: ["cloudflare"] }),
    ]);
    expect(rows.find((row) => row.id === "zustand")?.stacks).toEqual(["spa", "start", "tauri"]);
    expect(rows.find((row) => row.id === "downloads")?.needsStack).toBe("tauri");
  });
});

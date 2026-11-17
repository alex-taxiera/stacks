import { describe, expect, it } from "vitest";

import {
  diffSnapshots,
  groupOf,
  resolveAction,
  resolveNpm,
  type Fetch,
} from "../src/versions/resolve.ts";
import type { Policy, Snapshot } from "../src/versions/types.ts";

const NOW = new Date("2026-11-16T00:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

function fakeFetch(routes: Record<string, unknown>): Fetch {
  return async (url) => {
    const body = routes[url];
    if (body === undefined) return new Response("not found", { status: 404 });
    return Response.json(body);
  };
}

const packument = {
  "dist-tags": { latest: "2.1.0", beta: "3.0.0-beta.2" },
  versions: {
    "1.9.0": {},
    "2.0.0": {},
    "2.0.1": { deprecated: "broken" },
    "2.1.0": {},
    "3.0.0-beta.1": {},
    "3.0.0-beta.2": {},
  },
  time: {
    "1.9.0": daysAgo(100),
    "2.0.0": daysAgo(30),
    "2.0.1": daysAgo(20),
    "2.1.0": daysAgo(1),
    "3.0.0-beta.1": daysAgo(10),
    "3.0.0-beta.2": daysAgo(0),
  },
};
const fetchFn = fakeFetch({ "https://registry.npmjs.org/@scope%2fpkg": packument });
const base = { minAgeDays: 3, nodeMajor: "24", now: NOW, fetchFn };

describe("resolveNpm", () => {
  it("skips versions younger than the minimum age and deprecated ones", async () => {
    expect(await resolveNpm("@scope/pkg", base)).toBe("2.0.0");
  });

  it("holds a major back with a range", async () => {
    expect(await resolveNpm("@scope/pkg", { ...base, policy: { range: "^1" } })).toBe("1.9.0");
  });

  it("follows another dist-tag, prereleases included", async () => {
    expect(await resolveNpm("@scope/pkg", { ...base, policy: { tag: "beta" } })).toBe(
      "3.0.0-beta.1",
    );
  });

  it("tracks the Node major", async () => {
    const types = {
      "dist-tags": { latest: "26.1.0" },
      versions: { "24.5.0": {}, "26.1.0": {} },
      time: { "24.5.0": daysAgo(10), "26.1.0": daysAgo(10) },
    };
    const result = await resolveNpm("@types/node", {
      ...base,
      policy: { trackNode: true },
      fetchFn: fakeFetch({ "https://registry.npmjs.org/@types%2fnode": types }),
    });
    expect(result).toBe("24.5.0");
  });

  it("explains when nothing qualifies", async () => {
    await expect(resolveNpm("@scope/pkg", { ...base, policy: { range: "^9" } })).rejects.toThrow(
      /no version satisfies \^9/,
    );
  });
});

describe("resolveAction", () => {
  it("takes the newest major old enough, ignoring drafts and prereleases", async () => {
    const releases = [
      { tag_name: "v7.0.0", draft: false, prerelease: false, published_at: daysAgo(1) },
      { tag_name: "v6.2.0", draft: false, prerelease: false, published_at: daysAgo(40) },
      { tag_name: "v8.0.0-rc.1", draft: false, prerelease: true, published_at: daysAgo(40) },
      { tag_name: "v9.0.0", draft: true, prerelease: false, published_at: null },
    ];
    const tag = await resolveAction("actions/checkout", {
      minAgeDays: 3,
      now: NOW,
      token: "",
      fetchFn: fakeFetch({
        "https://api.github.com/repos/actions/checkout/releases?per_page=50": releases,
      }),
    });
    expect(tag).toBe("v6");
  });
});

const policy: Policy = {
  minReleaseAgeDays: 3,
  packages: {},
  groups: { storybook: ["storybook", "@storybook/*"] },
};

describe("groupOf", () => {
  it("matches names and prefixes, and puts the rest in misc", () => {
    expect(groupOf("storybook", policy)).toBe("storybook");
    expect(groupOf("@storybook/addon-mcp", policy)).toBe("storybook");
    expect(groupOf("left-pad", policy)).toBe("misc");
  });
});

const snapshot = (npm: Record<string, string>): Snapshot => ({
  schema: 1,
  minCliVersion: "0.1.0",
  updated: "2026-11-01",
  node: "24",
  pnpm: "12.0.0",
  npm,
  actions: {},
});

describe("diffSnapshots", () => {
  it("flags majors, and 0.x minors as majors", () => {
    const changes = diffSnapshots(
      snapshot({ storybook: "10.1.0", oxfmt: "0.73.0", vite: "8.0.0" }),
      snapshot({ storybook: "11.0.0", oxfmt: "0.74.0", vite: "8.1.0" }),
      policy,
    );
    expect(changes.map((change) => [change.name, change.major, change.group])).toEqual([
      ["storybook", true, "storybook"],
      ["oxfmt", true, "misc"],
      ["vite", false, "misc"],
    ]);
  });
});

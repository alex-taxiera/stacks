import { describe, expect, it } from "vitest";

import { neighbours, sortDocs } from "./docs";

const doc = (id: string, order: number) => ({ id, data: { order, title: id.toUpperCase() } });

describe("sortDocs", () => {
  it("puts the docs in reading order", () => {
    const sorted = sortDocs([doc("b", 2), doc("c", 3), doc("a", 1)]);
    expect(sorted.map((d) => d.id)).toEqual(["a", "b", "c"]);
  });
});

describe("neighbours", () => {
  const sorted = [doc("a", 1), doc("b", 2), doc("c", 3)];

  it("links the pages either side", () => {
    expect(neighbours(sorted, "b")).toEqual({
      previous: { href: "/docs/a/", title: "A" },
      next: { href: "/docs/c/", title: "C" },
    });
  });

  it("leaves out what isn't there", () => {
    expect(neighbours(sorted, "a")).toEqual({ next: { href: "/docs/b/", title: "B" } });
    expect(neighbours(sorted, "c")).toEqual({ previous: { href: "/docs/b/", title: "B" } });
    expect(neighbours(sorted, "missing")).toEqual({});
  });
});

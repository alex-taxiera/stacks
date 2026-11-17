import { describe, expect, it } from "vitest";

import { documentTitleFromMatches } from "./document-title";

describe("documentTitleFromMatches", () => {
  it("takes the deepest route's title", () => {
    expect(
      documentTitleFromMatches([{ meta: [{ title: "App" }] }, { meta: [{ title: "Page" }] }]),
    ).toBe("Page");
  });

  it("falls back to a parent's title", () => {
    expect(documentTitleFromMatches([{ meta: [{ title: "App" }] }, { meta: [] }])).toBe("App");
  });

  it("is undefined when no route has one", () => {
    expect(documentTitleFromMatches([{}])).toBeUndefined();
  });
});

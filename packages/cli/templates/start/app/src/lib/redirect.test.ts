import { describe, expect, it } from "vitest";

import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it("keeps paths on this site", () => {
    expect(safeRedirect("/account")).toBe("/account");
    expect(safeRedirect("/account?tab=email#top")).toBe("/account?tab=email#top");
  });

  it("drops other sites and anything that isn't a path", () => {
    expect(safeRedirect("https://example.com/")).toBeUndefined();
    expect(safeRedirect("//example.com/")).toBeUndefined();
    expect(safeRedirect("/\\example.com/")).toBeUndefined();
    expect(safeRedirect("account")).toBeUndefined();
    expect(safeRedirect(undefined)).toBeUndefined();
  });
});

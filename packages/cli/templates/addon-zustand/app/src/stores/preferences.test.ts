import { beforeEach, describe, expect, it } from "vitest";

import { usePreferences } from "./preferences";

describe("usePreferences", () => {
  // A store outlives a test; start each from its initial state.
  beforeEach(() => usePreferences.getState().reset());

  it("toggles the compact layout", () => {
    expect(usePreferences.getState().compact).toBe(false);
    usePreferences.getState().toggleCompact();
    expect(usePreferences.getState().compact).toBe(true);
  });
});

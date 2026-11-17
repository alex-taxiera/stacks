import { describe, expect, it } from "vitest";

import { greet } from "./greet.ts";

describe("greet", () => {
  it("greets the world by default", () => {
    expect(greet()).toBe("Hello, world!");
  });

  it("greets someone by name", () => {
    expect(greet("Ada")).toBe("Hello, Ada!");
  });

  it("falls back to the world for a blank name", () => {
    expect(greet("  ")).toBe("Hello, world!");
  });

  it("shouts", () => {
    expect(greet("Ada", { shout: true })).toBe("HELLO, ADA!");
  });
});

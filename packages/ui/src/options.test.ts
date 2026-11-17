import { describe, expect, it } from "vitest";

import { findOption, type Option } from "./options";

type Size = "small" | "large";
const SIZES: readonly Option<Size>[] = [
  { value: "small", label: "Small" },
  { value: "large", label: "Large" },
];

describe("findOption", () => {
  it("narrows a value that is one of the options", () => {
    const size: Size | undefined = findOption(SIZES, "large");
    expect(size).toBe("large");
  });

  it("gives undefined for a value that isn't", () => {
    expect(findOption(SIZES, "medium")).toBeUndefined();
    expect(findOption(SIZES, null)).toBeUndefined();
    expect(findOption(SIZES, undefined)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import { detectArch, detectOs } from "./platform";

const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";

describe("detectOs", () => {
  it("reads the system from the user agent", () => {
    expect(detectOs({ userAgent: WINDOWS })).toBe("windows");
    expect(detectOs({ userAgent: MAC })).toBe("macos");
    expect(detectOs({ userAgent: LINUX })).toBe("linux");
  });

  it("prefers client hints, and knows an iPad isn't a Mac", () => {
    expect(detectOs({ userAgent: WINDOWS, userAgentData: { platform: "macOS" } })).toBe("macos");
    expect(detectOs({ userAgent: MAC, maxTouchPoints: 5 })).toBeNull();
  });
});

describe("detectArch", () => {
  it("asks client hints first", async () => {
    const userAgentData = {
      platform: "Windows",
      getHighEntropyValues: async () => ({ architecture: "arm" }),
    };
    expect(await detectArch({ userAgent: WINDOWS, userAgentData })).toBe("arm64");
  });

  it("never trusts a Mac's user agent, which says Intel on Apple silicon too", async () => {
    expect(await detectArch({ userAgent: MAC })).toBeNull();
  });

  it("falls back to the user agent elsewhere", async () => {
    expect(await detectArch({ userAgent: LINUX })).toBe("x64");
  });
});

import { describe, expect, it } from "vitest";

import { release } from "./__fixtures__/release";
import { archFromName, archLabel, classify, formatSize, recommend, ruleFor } from "./artifacts";

const names = (artifacts: { asset: { name: string } }[]) => artifacts.map((a) => a.asset.name);

describe("classify", () => {
  const { apps, other } = classify(release.assets);

  it("puts each installer on its system's tab, recommended first", () => {
    expect(names(apps.windows)).toEqual(["App_0.2.0_x64-setup.exe", "App_0.2.0_x64_en-US.msi"]);
    expect(names(apps.macos)).toEqual(["App_0.2.0_universal.dmg"]);
    expect(names(apps.linux)).toEqual([
      "App_0.2.0_amd64.AppImage",
      "App_0.2.0_amd64.deb",
      "App-0.2.0-1.x86_64.rpm",
    ]);
  });

  it("hides the updater's files", () => {
    expect(ruleFor("latest.json")).toBe("hidden");
    expect(ruleFor("App_universal.app.tar.gz")).toBe("hidden");
    expect(ruleFor("App_0.2.0_x64-setup.exe.sig")).toBe("hidden");
  });

  it("lists a file no rule knows under other files", () => {
    expect(other.map((asset) => asset.name)).toEqual(["checksums.txt"]);
  });
});

describe("recommend", () => {
  const { apps } = classify(release.assets);

  it("offers the installer that fits the visitor's processor", () => {
    expect(recommend(apps.windows, "windows", "x64")?.asset.name).toBe("App_0.2.0_x64-setup.exe");
    expect(recommend(apps.macos, "macos", null)?.asset.name).toBe("App_0.2.0_universal.dmg");
  });

  it("still offers an x64 build to an ARM machine, which runs it", () => {
    expect(recommend(apps.windows, "windows", "arm64")?.asset.name).toBe(
      "App_0.2.0_x64-setup.exe",
    );
  });

  it("offers nothing when a system has no files", () => {
    expect(recommend([], "linux", "x64")).toBeNull();
  });
});

describe("names and sizes", () => {
  it("reads the architecture from a whole token only", () => {
    expect(archFromName("App_0.2.0_aarch64.dmg")).toBe("arm64");
    expect(archFromName("App_0.2.0_amd64.deb")).toBe("x64");
    expect(archFromName("Max64Tool.exe")).toBeNull();
  });

  it("labels architectures in each system's words", () => {
    expect(archLabel("macos", "arm64")).toBe("Apple silicon");
    expect(archLabel("windows", "x64")).toBe("64-bit");
    expect(archLabel("linux", null)).toBeNull();
  });

  it("formats sizes", () => {
    expect(formatSize(600)).toBe("600 B");
    expect(formatSize(4_200_000)).toBe("4 MB");
  });
});

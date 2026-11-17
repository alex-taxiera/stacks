import { describe, expect, it } from "vitest";

import { release } from "./__fixtures__/release";
import { latestOf, TAG_PREFIX, toRelease, versionOf } from "./github";

const published = (tag: string, extra: Record<string, unknown> = {}) => ({
  ...release,
  tag_name: tag,
  draft: false,
  prerelease: false,
  ...extra,
});

describe("latestOf", () => {
  it("takes the newest published release of the app, skipping other apps' and the updater's", () => {
    const releases = [
      published("other-app@v9.0.0"),
      published(`${TAG_PREFIX}0.3.0`, { draft: true }),
      published(`${TAG_PREFIX.replace("@v", "")}-updater`),
      published(`${TAG_PREFIX}0.2.0`),
      published(`${TAG_PREFIX}0.1.0`),
    ];
    expect(latestOf(releases)?.tag_name).toBe(`${TAG_PREFIX}0.2.0`);
  });

  it("is null when there's none, or GitHub's answer isn't a list", () => {
    expect(latestOf([published("other-app@v1.0.0")])).toBeNull();
    expect(latestOf({ message: "Not Found" })).toBeNull();
  });
});

describe("toRelease", () => {
  it("keeps only the fields the page reads", () => {
    const parsed = toRelease({ ...release, author: { login: "someone" }, body: "Notes" });
    expect(parsed).toEqual(release);
  });

  it("drops assets it can't read", () => {
    const parsed = toRelease({ ...release, assets: [{ name: "broken" }, release.assets[0]] });
    expect(parsed?.assets).toEqual([release.assets[0]]);
  });
});

it("reads the version from the tag", () => {
  expect(versionOf(release)).toBe("0.2.0");
});

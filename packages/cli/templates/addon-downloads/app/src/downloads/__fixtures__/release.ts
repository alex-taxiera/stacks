import { type Release, TAG_PREFIX } from "../github";

const TAG = `${TAG_PREFIX}0.2.0`;

/** A release's files, as the release workflow makes them: the installers and the updater's. */
const FILES: [name: string, size: number][] = [
  ["App_0.2.0_x64-setup.exe", 4_200_000],
  ["App_0.2.0_x64-setup.exe.sig", 420],
  ["App_0.2.0_x64_en-US.msi", 5_100_000],
  ["App_0.2.0_universal.dmg", 9_800_000],
  ["App_universal.app.tar.gz", 9_600_000],
  ["App_universal.app.tar.gz.sig", 420],
  ["App_0.2.0_amd64.AppImage", 82_000_000],
  ["App_0.2.0_amd64.deb", 4_900_000],
  ["App-0.2.0-1.x86_64.rpm", 4_900_000],
  ["latest.json", 2_100],
  ["checksums.txt", 600],
];

export const release: Release = {
  tag_name: TAG,
  name: `v0.2.0`,
  published_at: "2026-11-01T12:00:00Z",
  html_url: `https://github.com/owner/repo/releases/tag/${TAG}`,
  assets: FILES.map(([name, size]) => ({
    name,
    size,
    browser_download_url: `https://github.com/owner/repo/releases/download/${TAG}/${name}`,
  })),
};

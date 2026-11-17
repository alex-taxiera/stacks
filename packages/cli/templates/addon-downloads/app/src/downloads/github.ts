/**
 * The desktop app's latest published release, from GitHub's REST API. The API allows
 * cross-origin requests, so the browser asks it directly; the download page asks it as the site
 * is built.
 *
 * Every app in the repo releases under its own tag (`<app>@v<version>`), and the updater keeps a
 * release of its own (`<app>-updater`), so GitHub's "latest release" may be another app's: the
 * app's latest is the newest published release with its tag prefix.
 */

import { DESKTOP_APP, GITHUB_REPO } from "#/site-config";

export interface ReleaseAsset {
  name: string;
  /** Bytes. */
  size: number;
  browser_download_url: string;
}

export interface Release {
  tag_name: string;
  name: string | null;
  published_at: string | null;
  html_url: string;
  assets: ReleaseAsset[];
}

export const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`;
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

/** The desktop app's release tags start with this; the version follows it. */
export const TAG_PREFIX = `${DESKTOP_APP.name}@v`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringOrNull = (value: unknown): value is string | null =>
  typeof value === "string" || value === null;

function toAsset(value: unknown): ReleaseAsset | null {
  if (!isRecord(value)) return null;
  const { name, size, browser_download_url } = value;
  if (typeof name !== "string" || typeof size !== "number") return null;
  if (typeof browser_download_url !== "string") return null;
  return { name, size, browser_download_url };
}

/**
 * The fields the download page reads from a release, or `null` when `value` isn't one. Keeps only
 * those fields, so a release serialised into the page carries nothing else.
 */
export function toRelease(value: unknown): Release | null {
  if (!isRecord(value)) return null;
  const { tag_name, name, published_at, html_url, assets } = value;
  if (typeof tag_name !== "string" || typeof html_url !== "string") return null;
  if (!isStringOrNull(name) || !isStringOrNull(published_at)) return null;
  if (!Array.isArray(assets)) return null;
  return {
    tag_name,
    name,
    published_at,
    html_url,
    assets: assets.flatMap((asset) => {
      const parsed = toAsset(asset);
      return parsed ? [parsed] : [];
    }),
  };
}

/** The desktop app's newest published release in GitHub's list (newest first), or `null`. */
export function latestOf(releases: unknown): Release | null {
  if (!Array.isArray(releases)) return null;
  for (const value of releases) {
    if (!isRecord(value) || value.draft === true || value.prerelease === true) continue;
    const release = toRelease(value);
    if (release?.tag_name.startsWith(TAG_PREFIX)) return release;
  }
  return null;
}

/** The release's version, from its tag. */
export const versionOf = (release: Release) => release.tag_name.slice(TAG_PREFIX.length);

/** Rejects when GitHub can't be reached, or has no published release of the app. */
export async function fetchLatestRelease(
  options: { signal?: AbortSignal; token?: string } = {},
): Promise<Release> {
  const response = await fetch(RELEASES_API_URL, {
    signal: options.signal,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status}.`);
  const release = latestOf(await response.json());
  if (!release) throw new Error(`There's no published release of ${DESKTOP_APP.title} yet.`);
  return release;
}

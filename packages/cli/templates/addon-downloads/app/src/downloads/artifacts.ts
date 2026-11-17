/**
 * Sorts a release's files into what the download page offers. This is the only place that knows
 * about kinds of file: the page never names one.
 *
 * Every file is either hidden (the updater's files), matched by a rule, or listed under "Other
 * files". A new kind of file is offered the day a release ships it, and adding a rule for it
 * promotes it to its system's tab with a proper label.
 */

import type { ReleaseAsset } from "./github";

export type Os = "windows" | "macos" | "linux";
export type Arch = "x64" | "arm64" | "universal";

export const OSES: readonly Os[] = ["windows", "macos", "linux"];

export const OS_LABEL: Record<Os, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

export interface Rule {
  id: string;
  os: Os;
  label: string;
  test: RegExp;
  /** Which file a system's tab recommends: the highest that suits the visitor. */
  priority: number;
  note?: string;
}

export const RULES: readonly Rule[] = [
  { id: "nsis", os: "windows", label: "Installer", test: /-setup\.exe$/i, priority: 100 },
  {
    id: "msi",
    os: "windows",
    label: "MSI package",
    test: /\.msi$/i,
    priority: 90,
    note: "For installing across managed machines.",
  },
  { id: "dmg", os: "macos", label: "Disk image", test: /\.dmg$/i, priority: 100 },
  {
    id: "appimage",
    os: "linux",
    label: "AppImage",
    test: /\.AppImage$/i,
    priority: 100,
    note: "Runs on most distributions without installing.",
  },
  { id: "deb", os: "linux", label: "Debian and Ubuntu package", test: /\.deb$/i, priority: 90 },
  { id: "rpm", os: "linux", label: "Fedora and openSUSE package", test: /\.rpm$/i, priority: 80 },
];

/**
 * Files no visitor needs: the updater's manifest, its signatures, and the macOS update bundle.
 * Checked before the rules.
 */
export const HIDDEN: readonly RegExp[] = [/\.sig$/i, /^latest\.json$/i, /\.app\.tar\.gz$/i];

export interface Artifact {
  asset: ReleaseAsset;
  rule: Rule;
  os: Os;
  /** `null` when the file name doesn't say. */
  arch: Arch | null;
}

export interface Classified {
  /** The app's files for each system, recommended first. */
  apps: Record<Os, Artifact[]>;
  /** Files no rule knows, in the release's order. */
  other: ReleaseAsset[];
}

/** A token in a file name: the text between separators, so `x64` doesn't match inside a word. */
const token = (pattern: string) =>
  new RegExp(`(?:^|[._\\-\\s])(?:${pattern})(?=[._\\-\\s]|$)`, "i");

const ARCH_TOKENS: [Arch, RegExp][] = [
  ["universal", token("universal")],
  ["arm64", token("aarch64|arm64")],
  ["x64", token("x86_64|x64|amd64")],
];

export function archFromName(name: string): Arch | null {
  return ARCH_TOKENS.find(([, pattern]) => pattern.test(name))?.[0] ?? null;
}

/** The rule for a file, `"hidden"` for the updater's files, or `null` for one no rule knows. */
export function ruleFor(name: string): Rule | "hidden" | null {
  if (HIDDEN.some((pattern) => pattern.test(name))) return "hidden";
  return RULES.find((rule) => rule.test.test(name)) ?? null;
}

export function classify(assets: readonly ReleaseAsset[]): Classified {
  const apps: Record<Os, Artifact[]> = { windows: [], macos: [], linux: [] };
  const other: ReleaseAsset[] = [];
  for (const asset of assets) {
    const rule = ruleFor(asset.name);
    if (rule === "hidden") continue;
    if (rule) apps[rule.os].push({ asset, rule, os: rule.os, arch: archFromName(asset.name) });
    else other.push(asset);
  }
  for (const os of OSES) apps[os].sort((a, b) => b.rule.priority - a.rule.priority);
  return { apps, other };
}

/**
 * The architecture to assume when the browser doesn't say: most Macs sold since 2020 are Apple
 * silicon, and most Windows and Linux desktops are x64.
 */
export const DEFAULT_ARCH: Record<Os, Arch> = { windows: "x64", macos: "arm64", linux: "x64" };

/** How well a file's architecture suits the visitor's: 2 runs natively, 1 might, 0 won't. */
function archFit(artifact: Arch | null, visitor: Arch): number {
  if (artifact === visitor || artifact === "universal") return 2;
  if (artifact === null) return 1;
  // Windows and macOS on ARM run x64 builds; nothing runs an ARM build on x64.
  return artifact === "x64" ? 1 : 0;
}

/** The file to recommend from one system's files: the best fit for the visitor's architecture,
 * then the highest priority. */
export function recommend(
  artifacts: readonly Artifact[],
  os: Os,
  visitorArch: Arch | null,
): Artifact | null {
  const arch = visitorArch ?? DEFAULT_ARCH[os];
  let best: Artifact | null = null;
  let bestFit = -1;
  for (const artifact of artifacts) {
    const fit = archFit(artifact.arch, arch);
    if (fit > bestFit || (fit === bestFit && best && artifact.rule.priority > best.rule.priority)) {
      best = artifact;
      bestFit = fit;
    }
  }
  return best;
}

/** How a file's architecture reads on its system's tab. */
export function archLabel(os: Os, arch: Arch | null): string | null {
  switch (arch) {
    case null:
      return null;
    case "universal":
      return os === "macos" ? "Apple silicon and Intel" : "All processors";
    case "arm64":
      return os === "macos" ? "Apple silicon" : "ARM64";
    case "x64":
      return os === "macos" ? "Intel" : "64-bit";
  }
}

const SIZE = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${SIZE.format(bytes / 1024)} KB`;
  return `${SIZE.format(bytes / 1024 ** 2)} MB`;
}

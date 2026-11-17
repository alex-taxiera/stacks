/**
 * The known-good versions every generated repo is built from. Templates never name a version:
 * layers list package names, templates say `__ACTION[actions/checkout]__`, and this snapshot fills
 * them in. The nightly canary refreshes it, group by group, once a scaffold built from the new
 * versions passes lint, typecheck, tests and build.
 */
export interface Snapshot {
  schema: 1;
  /** The oldest CLI whose templates were tested against these versions. */
  minCliVersion: string;
  /** When the snapshot was last refreshed (ISO date). */
  updated: string;
  /** The Node major generated repos target (`.nvmrc`, `engines`, `@types/node`). */
  node: string;
  /** The exact pnpm version for `packageManager`. */
  pnpm: string;
  /** npm package → exact version; written to the catalog as `^version`. */
  npm: Record<string, string>;
  /** GitHub Action (`owner/repo`) → major tag, such as `v6`. */
  actions: Record<string, string>;
  /** Docker image → tag, such as `postgres` → `18-alpine`. Templates say `__IMAGE[postgres]__`. */
  images: Record<string, string>;
  /**
   * Rust crate → the requirement Cargo.toml gets: the major (`2`), or `0.minor` before 1.0.
   * Cargo.lock pins the rest. Templates say `__CRATE[tauri]__`.
   */
  crates: Record<string, string>;
}

export interface PackagePolicy {
  /** A semver range the version must satisfy, such as `^6` to hold a major back. */
  range?: string;
  /** Follow this dist-tag instead of `latest`, such as `beta` for a package with no stable line. */
  tag?: string;
  /** Match the Node major (for `@types/node`). */
  trackNode?: boolean;
  /** Why the policy exists, for whoever lifts it. */
  reason?: string;
}

export interface Policy {
  /**
   * Hold generated repos on this Node major instead of the newest LTS line. Lift it once the
   * machines and CI that build them have moved.
   */
  node?: { major: string; reason?: string };
  /** Skip versions published more recently than this, as a guard against broken or malicious releases. */
  minReleaseAgeDays: number;
  packages: Record<string, PackagePolicy>;
  /**
   * Packages that update together, so the canary tests and merges them as one. A pattern is a
   * name or a prefix ending in `*`. Anything that matches no group is in `misc`.
   */
  groups: Record<string, string[]>;
  /**
   * Which of a Docker image's tags to follow: a pattern whose numeric groups order the tags, such
   * as `^(\\d+)-alpine$` for Postgres majors. Images are the `docker` group.
   */
  images: Record<string, { tag: string; reason?: string }>;
}

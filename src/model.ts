import type { Snapshot } from "./versions/types.ts";

export type StackId = "spa";

export interface RepoInfo {
  /** The directory and root package name, kebab-case. */
  name: string;
  /** For READMEs and titles. */
  title: string;
  /** The npm scope every workspace package shares, such as `@my-repo`. */
  scope: string;
  /** The shared UI package's name, such as `@my-repo/ui`. */
  uiPackage: string;
  /** The Chakra palette `accent` points at. */
  accent: string;
}

export interface AppInfo {
  /** The folder under `apps/` and the package name, kebab-case. */
  name: string;
  title: string;
  stack: StackId;
  deploy: string;
  addons: string[];
  devPort: number;
  storybookPort: number;
}

/** `.stacks.json`, at the root of every generated repo: what `add` and `update` build on. */
export interface StacksFile {
  version: 1;
  /** The stacks version that last changed the repo. */
  cli: string;
  repo: RepoInfo;
  ui: { storybookPort: number };
  apps: AppInfo[];
}

export interface Ctx {
  repo: RepoInfo;
  ui: { storybookPort: number };
  versions: Snapshot;
  /** Set for app layers; unset for the repo layers `new` applies once. */
  app?: AppInfo;
  /** The day the repo or app is made, for `compatibility_date` and the like. */
  today: string;
}

/** Where a file or package lands: the repo root, `packages/ui`, or the app's folder. */
export type Target = "root" | "ui" | "app";

export interface PackageContribution {
  /** Names only; versions come from the snapshot, through the catalog. */
  dependencies?: string[];
  devDependencies?: string[];
  peerDependencies?: string[];
  /** Workspace packages, depended on as `workspace:*`. */
  workspaceDependencies?: string[];
  scripts?: Record<string, string>;
  /** Other top-level fields, merged deeply (`exports`, `imports`, `lint-staged`…). */
  fields?: Record<string, unknown>;
}

export interface McpServer {
  type?: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
}

/** A block of AGENTS.md inside one of its `<!-- stacks:<region>:start -->` regions. */
export interface AgentsBlock {
  region: "apps" | "rules" | "mcp";
  id: string;
  body: string;
}

export interface PostStep {
  /** Shown while it runs. */
  title: string;
  command: string;
  args: string[];
  /** Relative to the repo root. */
  cwd?: string;
  /** Needs `pnpm install` to have run. */
  needsInstall?: boolean;
  /** A failure warns rather than stops the scaffold. */
  optional?: boolean;
  /** Give up after this long. */
  timeoutMs?: number;
}

export interface LayerSpec {
  id: string;
  /** Template directory under `templates/`, holding `root/`, `ui/` and `app/`. Defaults to `id`. */
  templates?: string | false;
  packages?: Partial<Record<Target, PackageContribution>>;
  /** Deep-merged into JSON files at the root (arrays are unioned). */
  json?: Record<string, unknown>;
  /** Deep-merged into YAML files at the root. */
  yaml?: Record<string, unknown>;
  /** Lines appended, once, to text files at the root (`.gitignore`). */
  lines?: Record<string, string[]>;
  agents?: AgentsBlock[];
  /** Merged into `.agents/mcp.json`. */
  mcp?: Record<string, McpServer>;
  post?: PostStep[];
}

export type Layer = (ctx: Ctx) => LayerSpec;

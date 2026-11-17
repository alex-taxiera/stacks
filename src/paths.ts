import { readFileSync } from "node:fs";
import path from "node:path";

/** The package's root: one level above both `src/` (when run from source) and `dist/`. */
export const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");

export const TEMPLATES_DIR = path.join(PACKAGE_ROOT, "templates");
export const BUNDLED_VERSIONS_FILE = path.join(PACKAGE_ROOT, "versions.json");
export const POLICY_FILE = path.join(PACKAGE_ROOT, "versions.policy.json");

export const CLI_VERSION: string = (
  JSON.parse(readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")) as { version: string }
).version;
